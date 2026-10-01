"use client";

import { CONTENT_STATUS_LABELS } from "@/lib/research/labels";

export type SourceItem = {
  refId: string;
  title: string;
  authors: string[];
  year?: number;
  journal?: string;
  doi?: string;
  contentStatus: string;
};

export function SourcesPanel({
  sources,
  selectedIds,
}: {
  sources: SourceItem[];
  selectedIds: string[];
}) {
  const selected = new Set(selectedIds);
  return (
    <ul className="space-y-3">
      {sources.map((source) => (
        <li
          key={source.refId}
          className={`rounded-lg border p-3 text-sm ${
            selected.has(source.refId) ? "border-primary" : "border-border"
          }`}
        >
          <p className="font-medium">{source.title}</p>
          <p className="mt-1 text-muted-foreground">
            {(source.authors[0] ?? "Unknown") +
              (source.year ? ` (${source.year})` : "")}
          </p>
          {source.doi ? (
            <p className="mt-1 text-xs text-muted-foreground">{source.doi}</p>
          ) : null}
          <p className="mt-1 text-xs">
            {CONTENT_STATUS_LABELS[
              source.contentStatus as keyof typeof CONTENT_STATUS_LABELS
            ] ?? source.contentStatus}
          </p>
        </li>
      ))}
    </ul>
  );
}
