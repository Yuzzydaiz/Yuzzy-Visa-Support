"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  DRAFT_STORAGE_KEY,
  IDEMPOTENCY_STORAGE_KEY,
  defaultResearchDraft,
  type ResearchDraft,
} from "@/lib/research/draft";

const listeners = new Set<() => void>();
let memoryDraft: ResearchDraft = defaultResearchDraft();
let didReadStorage = false;

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function isDraft(value: unknown): value is ResearchDraft {
  if (!value || typeof value !== "object") {
    return false;
  }
  const draft = value as ResearchDraft;
  return (
    Array.isArray(draft.authors) &&
    Array.isArray(draft.references) &&
    (draft.step === "details" ||
      draft.step === "sources" ||
      draft.step === "review")
  );
}

function readStorage(): ResearchDraft {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) {
      return defaultResearchDraft();
    }
    const parsed: unknown = JSON.parse(raw);
    if (isDraft(parsed)) {
      return { ...defaultResearchDraft(), ...parsed };
    }
  } catch {
    /* ignore */
  }
  return defaultResearchDraft();
}

function persist(draft: ResearchDraft) {
  memoryDraft = draft;
  window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  emit();
}

// Called once an order is paid: the draft has become a paper, so the wizard
// must start empty and the next checkout must not reuse the old order's key.
export function clearResearchDraft() {
  memoryDraft = defaultResearchDraft();
  didReadStorage = true;
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    window.sessionStorage.removeItem(IDEMPOTENCY_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  if (!didReadStorage) {
    didReadStorage = true;
    memoryDraft = readStorage();
  }
  return memoryDraft;
}

const serverDraft = defaultResearchDraft();

function getServerSnapshot() {
  return serverDraft;
}

export function useResearchDraft() {
  const draft = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setDraft = useCallback((next: ResearchDraft) => {
    persist(next);
  }, []);

  const update = useCallback((patch: Partial<ResearchDraft>) => {
    persist({ ...getSnapshot(), ...patch });
  }, []);

  return { draft, setDraft, update, hydrated: true };
}
