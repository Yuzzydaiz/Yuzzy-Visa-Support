"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ResearchEditor } from "@/components/research/research-editor";
import { SourcesPanel, type SourceItem } from "@/components/research/sources-panel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ACCESS_STORAGE_KEY } from "@/lib/research/draft";
import { sectionsToTiptapDoc, type TiptapDoc } from "@/lib/research/editor/document";
import type { SectionJson } from "@/lib/research/ai/schemas";

export type WorkspacePaper = {
  publicId: string;
  title: string;
  status: string;
  editorVersion: number;
  citationStyle: string;
  sections: Array<{
    sectionId: string;
    title: string;
    type: string;
    contentJson: unknown;
    plainText: string;
    generationStatus: string;
    validationWarnings?: string[];
  }>;
  references: SourceItem[];
  bibliography: string[];
  regeneration: { used: number; limit: number };
  editorDocument?: TiptapDoc | null;
};

function readStoredToken() {
  const stored = sessionStorage.getItem(ACCESS_STORAGE_KEY);
  if (!stored) {
    return undefined;
  }
  try {
    return (JSON.parse(stored) as { token?: string }).token;
  } catch {
    return undefined;
  }
}

function authHeaders(): HeadersInit | undefined {
  const token = readStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function docFromPaper(paper: WorkspacePaper): TiptapDoc {
  if (paper.editorDocument?.type === "doc") {
    return paper.editorDocument;
  }
  return sectionsToTiptapDoc(
    paper.sections.map((section) => {
      const json = section.contentJson as SectionJson | null;
      return {
        sectionId: section.sectionId,
        title: section.title,
        paragraphs: json?.paragraphs,
        plainText: section.plainText,
      };
    }),
  );
}

export function PaperWorkspace({
  paperId,
  initial,
}: {
  paperId: string;
  initial: WorkspacePaper;
}) {
  const [paper, setPaper] = useState(initial);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "failed" | "conflict">(
    "saved",
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState(initial.sections[0]?.sectionId);
  const [instruction, setInstruction] = useState("");
  const [regenError, setRegenError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const editorVersion = useRef(initial.editorVersion);
  const pending = useRef<{ doc: TiptapDoc; revision: number } | null>(null);
  const editRevision = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const doc = useMemo(() => docFromPaper(paper), [paper]);

  async function patchOnce(
    contentJson: TiptapDoc,
    revision: number,
  ): Promise<"saved" | "failed" | "conflict"> {
    setSaveState("saving");
    try {
      const response = await fetch(
        `/api/research/papers/${encodeURIComponent(paperId)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(authHeaders() ?? {}),
          },
          body: JSON.stringify({
            editorVersion: editorVersion.current,
            contentJson,
          }),
        },
      );
      const payload = (await response.json()) as WorkspacePaper & {
        message?: string;
        code?: string;
      };
      if (response.status === 409) {
        setSaveState("conflict");
        return "conflict";
      }
      if (!response.ok) {
        setSaveState("failed");
        return "failed";
      }
      editorVersion.current = payload.editorVersion;
      setPaper((current) => ({ ...current, ...payload }));
      if (pending.current && pending.current.revision <= revision) {
        pending.current = null;
      }
      setSaveState(pending.current ? "saving" : "saved");
      return "saved";
    } catch {
      setSaveState("failed");
      return "failed";
    }
  }

  function drain(): Promise<boolean> {
    if (inFlight.current) {
      return inFlight.current;
    }
    const run = (async () => {
      let ok = true;
      while (pending.current) {
        const entry = pending.current;
        const result = await patchOnce(entry.doc, entry.revision);
        if (result !== "saved") {
          ok = false;
          break;
        }
      }
      return ok;
    })();
    inFlight.current = run;
    void run.finally(() => {
      if (inFlight.current === run) {
        inFlight.current = null;
      }
    });
    return run;
  }

  async function flush(): Promise<boolean> {
    window.clearTimeout(timer.current);
    return drain();
  }

  function queueSave(next: TiptapDoc) {
    editRevision.current += 1;
    pending.current = { doc: next, revision: editRevision.current };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void drain();
    }, 800);
  }

  useEffect(() => {
    function onHide() {
      window.clearTimeout(timer.current);
      void drain();
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        onHide();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onHide/drain use refs and stable state setters
  }, [paperId]);

  async function regenerate() {
    if (!activeSection) {
      return;
    }
    setBusy(true);
    setRegenError(undefined);
    try {
      const flushed = await flush();
      if (!flushed) {
        setRegenError("Save your pending edits before regenerating.");
        return;
      }
      const response = await fetch(
        `/api/research/papers/${encodeURIComponent(paperId)}/regenerate`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(authHeaders() ?? {}),
          },
          body: JSON.stringify({
            sectionId: activeSection,
            instruction: instruction || undefined,
          }),
        },
      );
      const payload = (await response.json()) as WorkspacePaper & { message?: string };
      if (!response.ok) {
        setRegenError(payload.message ?? "Could not regenerate this section.");
        return;
      }
      window.clearTimeout(timer.current);
      pending.current = null;
      editorVersion.current = payload.editorVersion;
      setPaper((current) => ({ ...current, ...payload }));
      setSaveState("saved");
      setEditorKey((value) => value + 1);
    } catch {
      setRegenError("Could not regenerate this section.");
    } finally {
      setBusy(false);
    }
  }

  async function download(format: "docx" | "pdf") {
    try {
      const flushed = await flush();
      if (!flushed) {
        setRegenError("Save your pending edits before exporting.");
        return;
      }
      const response = await fetch(
        `/api/research/papers/${encodeURIComponent(paperId)}/export?format=${format}`,
        { credentials: "include", headers: authHeaders() },
      );
      if (!response.ok) {
        setRegenError("Export failed.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${paper.title}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setRegenError("Export failed.");
    }
  }

  const remaining = paper.regeneration.limit - paper.regeneration.used;
  const flaggedSections = paper.sections.filter(
    (section) => (section.validationWarnings?.length ?? 0) > 0,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)_16rem]">
      <aside className="hidden lg:block">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Outline
        </p>
        <ol className="mt-2 space-y-1">
          {paper.sections.map((section) => (
            <li key={section.sectionId}>
              <button
                type="button"
                onClick={() => setActiveSection(section.sectionId)}
                className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                  activeSection === section.sectionId ? "bg-muted" : ""
                }`}
              >
                {section.title}
              </button>
            </li>
          ))}
        </ol>
      </aside>
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-semibold">{paper.title}</h1>
          <span className="text-xs text-muted-foreground">
            {saveState === "saving"
              ? "Saving"
              : saveState === "failed"
                ? "Save failed"
                : saveState === "conflict"
                  ? "Newer version exists"
                  : "Saved"}
          </span>
        </div>
        {saveState === "conflict" ? (
          <button
            type="button"
            className="h-11 rounded-lg border border-border px-5 text-sm"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        ) : null}
        <div className="flex flex-wrap gap-2 lg:hidden">
          <Sheet>
            <SheetTrigger className="inline-flex h-11 items-center rounded-lg border border-border px-5 text-sm">
              Outline
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Outline</SheetTitle>
              </SheetHeader>
              <ol className="mt-4 space-y-1">
                {paper.sections.map((section) => (
                  <li key={section.sectionId}>
                    <button
                      type="button"
                      onClick={() => setActiveSection(section.sectionId)}
                      className="w-full rounded-md px-2 py-2 text-left text-sm"
                    >
                      {section.title}
                    </button>
                  </li>
                ))}
              </ol>
            </SheetContent>
          </Sheet>
          <Sheet>
            <SheetTrigger className="inline-flex h-11 items-center rounded-lg border border-border px-5 text-sm">
              Sources
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Sources</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <SourcesPanel sources={paper.references} selectedIds={selectedIds} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
        {flaggedSections.length > 0 ? (
          <div
            className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm"
            role="status"
          >
            <p className="font-medium">Needs review</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
              {flaggedSections.map((section) => (
                <li key={section.sectionId}>
                  {section.title}: {(section.validationWarnings ?? []).join(" ")}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="rounded-xl border border-border p-4">
          <ResearchEditor
            key={editorKey}
            doc={doc}
            onChange={queueSave}
            onSelectCitation={setSelectedIds}
          />
        </div>
        <div className="space-y-2 rounded-xl border border-border p-4">
          <p className="text-sm font-medium">
            Regenerate section ({remaining} left)
          </p>
          <textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            maxLength={500}
            className="min-h-20 w-full rounded-md border border-border bg-background p-2 text-sm"
            placeholder="Optional instruction"
          />
          <button
            type="button"
            disabled={busy || remaining <= 0}
            onClick={() => void regenerate()}
            className="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Regenerating…" : "Regenerate"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void download("docx")}
            className="inline-flex h-11 items-center rounded-lg border border-border px-5 text-sm"
          >
            Download DOCX
          </button>
          <button
            type="button"
            onClick={() => void download("pdf")}
            className="inline-flex h-11 items-center rounded-lg border border-border px-5 text-sm"
          >
            Download PDF
          </button>
        </div>
        {regenError ? (
          <p className="text-sm text-destructive" role="alert">
            {regenError}
          </p>
        ) : null}
        {paper.bibliography.length ? (
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
      <aside className="hidden lg:block">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Sources
        </p>
        <div className="mt-2">
          <SourcesPanel sources={paper.references} selectedIds={selectedIds} />
        </div>
      </aside>
    </div>
  );
}
