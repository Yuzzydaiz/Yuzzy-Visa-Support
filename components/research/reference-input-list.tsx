"use client";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { detectReferenceInputType } from "@/lib/validation/research";
import { type DraftReference, type ResearchDraft } from "@/lib/research/draft";
import {
  CONTENT_STATUS_LABELS,
  VERIFICATION_LABELS,
} from "@/lib/research/labels";

const TYPE_LABEL = {
  doi: "Looks like a DOI",
  url: "Looks like a URL",
  citation: "Looks like citation text",
} as const;

export function ReferenceInputList({
  draft,
  error,
  onChange,
}: {
  draft: ResearchDraft;
  maxReferences: number;
  error?: string;
  onChange: (patch: Partial<ResearchDraft>) => void;
}) {

  function patchReference(id: string, patch: Partial<DraftReference>) {
    onChange({
      references: draft.references.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  }

  return (
    <FieldGroup className="gap-4">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {draft.references.map((reference, index) => {
        const kind = reference.originalInput.trim()
          ? detectReferenceInputType(reference.originalInput)
          : null;
        const status = reference.verificationStatus ?? "pending";
        return (
          <article
            key={reference.id}
            className="rounded-[16px] border border-brand-navy/10 bg-brand-white p-4 shadow-[0_8px_24px_-16px_rgba(4,46,94,0.18)]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-heading text-sm font-semibold">
                Source {index + 1}
              </h3>
              <p className="text-xs text-muted-foreground">
                {VERIFICATION_LABELS[status]}
              </p>
            </div>
            <Field className="mt-3">
              <FieldLabel htmlFor={`ref-input-${reference.id}`}>
                DOI, URL, or citation
              </FieldLabel>
              <Textarea
                id={`ref-input-${reference.id}`}
                value={reference.originalInput}
                onChange={(event) => {
                  patchReference(reference.id, {
                    originalInput: event.target.value,
                    verificationStatus: "pending",
                    matched: undefined,
                    candidates: [],
                    contentStatus: undefined,
                  });
                }}
                rows={3}
              />
              {kind ? (
                <p className="text-xs text-muted-foreground">{TYPE_LABEL[kind]}</p>
              ) : null}
            </Field>
            <Field className="mt-3">
              <FieldLabel htmlFor={`ref-notes-${reference.id}`}>
                Abstract or key findings (optional)
              </FieldLabel>
              <Input
                id={`ref-notes-${reference.id}`}
                value={reference.userProvidedNotes}
                onChange={(event) => {
                  patchReference(reference.id, {
                    userProvidedNotes: event.target.value,
                  });
                }}
              />
            </Field>

            {reference.matched ? (
              <div className="mt-3 rounded-lg border border-brand-navy/10 bg-[color-mix(in_oklch,var(--brand-navy)_4%,white)] p-3 text-sm">
                <p className="font-medium">{reference.matched.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[reference.matched.year, reference.matched.doi]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {reference.contentStatus ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {CONTENT_STATUS_LABELS[reference.contentStatus]}
                  </p>
                ) : null}
              </div>
            ) : null}

            {status === "ambiguous" && reference.candidates?.length ? (
              <ul className="mt-3 space-y-2">
                {reference.candidates.map((candidate) => (
                  <li key={`${candidate.doi ?? candidate.title}`}>
                    <button
                      type="button"
                      className="w-full rounded-lg border border-brand-navy/15 px-3 py-2 text-left text-sm hover:border-brand-navy/40"
                      onClick={() => {
                        patchReference(reference.id, {
                          verificationStatus: "verified",
                          matched: candidate,
                          candidates: [],
                          contentStatus: candidate.abstract
                            ? "abstract"
                            : reference.userProvidedNotes.trim()
                              ? "user_notes"
                              : "metadata_only",
                        });
                      }}
                    >
                      <span className="font-medium">{candidate.title}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {[candidate.year, candidate.doi, candidate.authors[0]]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {reference.isSystemAdded ? (
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                Suggested extra source
              </p>
            ) : null}
            {reference.isSystemAdded ? (
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reference.selectedByUser !== false}
                  onChange={(event) =>
                    patchReference(reference.id, {
                      selectedByUser: event.target.checked,
                    })
                  }
                />
                Include this extra source
              </label>
            ) : null}

            {status === "unverified" ? (
              <p className="mt-3 text-sm text-destructive">
                This source could not be matched. Correct it or remove it before
                review.
              </p>
            ) : null}

            {draft.references.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                className="mt-2"
                onClick={() =>
                  onChange({
                    references: draft.references.filter(
                      (item) => item.id !== reference.id,
                    ),
                  })
                }
              >
                Remove source
              </Button>
            ) : null}
          </article>
        );
      })}
      <FieldError>{error}</FieldError>
    </FieldGroup>
  );
}
