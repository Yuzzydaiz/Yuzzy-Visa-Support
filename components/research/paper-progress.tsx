"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  RecoveryTokenForm,
  readStoredToken,
} from "@/components/research/recovery-token";
import type { WorkspacePaper } from "@/components/research/paper-workspace";

const PaperWorkspace = dynamic(
  async () => {
    const mod = await import("@/components/research/paper-workspace");
    return mod.PaperWorkspace;
  },
  { ssr: false, loading: () => <p className="text-sm text-muted-foreground">Loading editor…</p> },
);

type PaperPayload = {
  publicId: string;
  status: string;
  title: string;
  editorVersion?: number;
  citationStyle?: string;
  sections: Array<{
    sectionId: string;
    title: string;
    type?: string;
    contentJson?: unknown;
    generationStatus: string;
    partsTotal?: number;
    partsDone?: number;
    plainText: string;
    citationHtml: string;
  }>;
  references?: WorkspacePaper["references"];
  bibliography: string[];
  regeneration?: { used: number; limit: number };
  generation?: { lastError?: string; completedSteps?: string[] };
  editorDocument?: unknown;
};

export function PaperProgress({ paperId }: { paperId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [paper, setPaper] = useState<PaperPayload | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [needsToken, setNeedsToken] = useState(false);
  const [reload, setReload] = useState(0);
  const running = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const token = searchParams.get("token") || readStoredToken();
      const qs = token && searchParams.get("token")
        ? `?token=${encodeURIComponent(token)}`
        : "";
      const response = await fetch(
        `/api/research/papers/${encodeURIComponent(paperId)}${qs}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          credentials: "include",
        },
      );
      const payload = (await response.json()) as PaperPayload & { message?: string };
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setError(payload.message ?? "Could not load this paper.");
        setNeedsToken(response.status === 401 || response.status === 403);
        return;
      }
      setError(undefined);
      setNeedsToken(false);
      setPaper(payload);
      if (searchParams.get("token")) {
        router.replace(`/research/paper/${encodeURIComponent(paperId)}`);
      }
    }
    void poll();
    return () => {
      cancelled = true;
    };
  }, [paperId, router, searchParams, reload]);

  async function generateLoop() {
    if (running.current) {
      return;
    }
    running.current = true;
    setBusy(true);
    setError(undefined);
    try {
      // One request per step: the outline, then each section part. A 40 page
      // paper splits into roughly 15 parts; keep generous headroom.
      for (let i = 0; i < 100; i += 1) {
        const token = searchParams.get("token") || readStoredToken();
        const response = await fetch(
          `/api/research/papers/${encodeURIComponent(paperId)}/generate-next`,
          {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            credentials: "include",
          },
        );
        const payload = (await response.json()) as PaperPayload & {
          message?: string;
          status?: string;
        };
        if (!response.ok) {
          setError(payload.message ?? "Generation failed.");
          return;
        }
        setPaper(payload);
        if (payload.status === "completed") {
          return;
        }
      }
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  const status = paper?.status ?? "loading";
  const canStart =
    status === "ready" || status === "generating" || status === "failed";

  if (status === "completed" && paper) {
    return (
      <PaperWorkspace
        paperId={paperId}
        initial={{
          publicId: paper.publicId,
          title: paper.title,
          status: paper.status,
          editorVersion: paper.editorVersion ?? 0,
          citationStyle: paper.citationStyle ?? "apa",
          sections: paper.sections,
          references: paper.references ?? [],
          bibliography: paper.bibliography ?? [],
          regeneration: paper.regeneration ?? { used: 0, limit: 3 },
          editorDocument: (paper.editorDocument ?? null) as WorkspacePaper["editorDocument"],
        } as WorkspacePaper}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">
          {paper?.title ?? "Research draft"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Status: {status}</p>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {needsToken ? (
        <RecoveryTokenForm
          paperPublicId={paperId}
          onSaved={() => setReload((value) => value + 1)}
        />
      ) : null}
      {paper?.generation?.lastError ? (
        <p className="text-sm text-destructive">{paper.generation.lastError}</p>
      ) : null}
      {canStart ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void generateLoop()}
          className="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Generating…" : status === "ready" ? "Start draft" : "Continue"}
        </button>
      ) : null}
      <ol className="space-y-3">
        {(paper?.sections ?? []).map((section) => (
          <li
            key={section.sectionId}
            className="rounded-lg border border-border p-4"
          >
            <p className="text-sm font-medium">
              {section.title}{" "}
              <span className="text-muted-foreground">
                ({section.generationStatus}
                {section.generationStatus !== "complete" &&
                (section.partsTotal ?? 1) > 1
                  ? `, part ${Math.min((section.partsDone ?? 0) + 1, section.partsTotal ?? 1)} of ${section.partsTotal}`
                  : ""}
                )
              </span>
            </p>
            {section.citationHtml || section.plainText ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                {section.citationHtml || section.plainText}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
      {paper?.bibliography?.length ? (
        <div>
          <h2 className="font-heading text-lg font-semibold">References</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {paper.bibliography.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
