"use client";

import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  CITATION_STYLE_IDS,
  parseResearchProductConfig,
  type CitationStyleId,
} from "@/lib/config/research-product";
import {
  emptyAuthor,
  type DraftAuthor,
  type ResearchDraft,
} from "@/lib/research/draft";
import { CITATION_STYLE_LABELS, PAPER_TYPE_CARDS } from "@/lib/research/labels";
import { cn } from "@/lib/utils";

export function PaperDetailsForm({
  draft,
  errors,
  onChange,
}: {
  draft: ResearchDraft;
  errors: Record<string, string>;
  onChange: (patch: Partial<ResearchDraft>) => void;
}) {
  const config = parseResearchProductConfig({});
  const selectedType =
    PAPER_TYPE_CARDS.find((card) => card.id === draft.paperType) ??
    PAPER_TYPE_CARDS[0];

  function patchAuthor(index: number, patch: Partial<DraftAuthor>) {
    const authors = draft.authors.slice();
    authors[index] = { ...authors[index], ...patch };
    onChange({ authors });
  }

  return (
    <FieldGroup className="gap-6">
      <Field data-invalid={!!errors.title || undefined}>
        <FieldLabel htmlFor="research-title">Research title</FieldLabel>
        <Input
          id="research-title"
          value={draft.title}
          onChange={(event) => onChange({ title: event.target.value })}
          aria-invalid={!!errors.title}
          required
          className="h-11"
        />
        <FieldError>{errors.title}</FieldError>
      </Field>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-heading text-base font-semibold">Author details</h3>
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange({ authors: [...draft.authors, emptyAuthor()] })}
          >
            Add author
          </Button>
        </div>
        {draft.authors.map((author, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-[16px] border border-brand-navy/10 bg-brand-white p-4 md:grid-cols-2"
          >
            <Field data-invalid={!!errors[`authors.${index}.name`] || undefined}>
              <FieldLabel htmlFor={`author-name-${index}`}>Name</FieldLabel>
              <Input
                id={`author-name-${index}`}
                value={author.name}
                onChange={(event) => patchAuthor(index, { name: event.target.value })}
                aria-invalid={!!errors[`authors.${index}.name`]}
                required
              />
              <FieldError>{errors[`authors.${index}.name`]}</FieldError>
            </Field>
            <Field
              data-invalid={!!errors[`authors.${index}.affiliation`] || undefined}
            >
              <FieldLabel htmlFor={`author-aff-${index}`}>Affiliation</FieldLabel>
              <Input
                id={`author-aff-${index}`}
                value={author.affiliation}
                onChange={(event) =>
                  patchAuthor(index, { affiliation: event.target.value })
                }
                aria-invalid={!!errors[`authors.${index}.affiliation`]}
                required
              />
              <FieldError>{errors[`authors.${index}.affiliation`]}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor={`author-dept-${index}`}>
                Department (optional)
              </FieldLabel>
              <Input
                id={`author-dept-${index}`}
                value={author.department}
                onChange={(event) =>
                  patchAuthor(index, { department: event.target.value })
                }
              />
            </Field>
            <Field data-invalid={!!errors[`authors.${index}.email`] || undefined}>
              <FieldLabel htmlFor={`author-email-${index}`}>
                Author email (optional)
              </FieldLabel>
              <Input
                id={`author-email-${index}`}
                type="email"
                value={author.email}
                onChange={(event) => patchAuthor(index, { email: event.target.value })}
                aria-invalid={!!errors[`authors.${index}.email`]}
              />
              <FieldError>{errors[`authors.${index}.email`]}</FieldError>
            </Field>
            <Field className="md:col-span-2">
              <FieldLabel htmlFor={`author-orcid-${index}`}>
                ORCID (optional)
              </FieldLabel>
              <Input
                id={`author-orcid-${index}`}
                value={author.orcid}
                onChange={(event) => patchAuthor(index, { orcid: event.target.value })}
              />
            </Field>
            {draft.authors.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                className="md:col-span-2 w-fit"
                onClick={() =>
                  onChange({
                    authors: draft.authors.filter((_, i) => i !== index),
                  })
                }
              >
                Remove author
              </Button>
            ) : null}
          </div>
        ))}
      </div>

      <Field data-invalid={!!errors.requestedPages || undefined}>
        <FieldLabel htmlFor="research-pages">Pages</FieldLabel>
        <Input
          id="research-pages"
          type="number"
          min={config.minPages}
          max={config.maxPages}
          value={draft.requestedPages}
          onChange={(event) =>
            onChange({
              requestedPages: Number.parseInt(event.target.value, 10) || 0,
            })
          }
          aria-invalid={!!errors.requestedPages}
          required
          className="h-11 max-w-xs"
        />
        <p className="text-xs text-muted-foreground">
          One page is 300 words of body text. Minimum 10 pages (₦2,500).
        </p>
        <FieldError>{errors.requestedPages}</FieldError>
      </Field>

      <Field data-invalid={!!errors.customerEmail || undefined}>
        <FieldLabel htmlFor="research-email">
          Email for this order
        </FieldLabel>
        <Input
          id="research-email"
          type="email"
          autoComplete="email"
          value={draft.customerEmail}
          onChange={(event) => onChange({ customerEmail: event.target.value })}
          aria-invalid={!!errors.customerEmail}
          aria-describedby="research-email-help"
          required
          className="h-11"
        />
        <p id="research-email-help" className="text-xs text-muted-foreground">
          We use this address for your order and payment. Keep the recovery token shown at checkout: it is the only way to reopen your paper from another browser.
        </p>
        <FieldError>{errors.customerEmail}</FieldError>
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Paper type (optional)</legend>
        <div className="grid grid-cols-3 gap-2">
          {PAPER_TYPE_CARDS.map((card) => {
            const selected = draft.paperType === card.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => onChange({ paperType: card.id })}
                className={cn(
                  "rounded-lg border px-2 py-2 text-left text-xs font-medium transition-colors sm:text-sm",
                  selected
                    ? "border-brand-navy bg-brand-navy/6 text-brand-navy"
                    : "border-brand-navy/10 bg-brand-white hover:border-brand-navy/25",
                )}
                aria-pressed={selected}
              >
                {card.title}
              </button>
            );
          })}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {selectedType.will} {selectedType.willNot}
        </p>
      </fieldset>

      {draft.paperType === "original_research_draft" ? (
        <>
          <Field data-invalid={!!errors.actualMethodology || undefined}>
            <FieldLabel htmlFor="research-method">Actual methodology</FieldLabel>
            <Textarea
              id="research-method"
              value={draft.actualMethodology}
              onChange={(event) =>
                onChange({ actualMethodology: event.target.value })
              }
              rows={5}
              aria-invalid={!!errors.actualMethodology}
            />
            <FieldError>{errors.actualMethodology}</FieldError>
          </Field>
          <Field data-invalid={!!errors.actualFindings || undefined}>
            <FieldLabel htmlFor="research-findings">Actual findings</FieldLabel>
            <Textarea
              id="research-findings"
              value={draft.actualFindings}
              onChange={(event) => onChange({ actualFindings: event.target.value })}
              rows={5}
              aria-invalid={!!errors.actualFindings}
            />
            <FieldError>{errors.actualFindings}</FieldError>
          </Field>
        </>
      ) : null}

      <details className="rounded-lg border border-brand-navy/10 bg-brand-white px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-brand-navy">
          Optional details
        </summary>
        <div className="mt-4 space-y-4">
          <Field data-invalid={!!errors.focus || undefined}>
            <FieldLabel htmlFor="research-focus">
              Focus or objective (optional)
            </FieldLabel>
            <Textarea
              id="research-focus"
              value={draft.focus}
              onChange={(event) => onChange({ focus: event.target.value })}
              rows={3}
              aria-invalid={!!errors.focus}
            />
            <FieldError>{errors.focus}</FieldError>
          </Field>

          <Field data-invalid={!!errors.citationStyle || undefined}>
            <FieldLabel>Citation style (optional)</FieldLabel>
            <Select
              value={draft.citationStyle}
              onValueChange={(value) =>
                onChange({ citationStyle: value as CitationStyleId })
              }
            >
              <SelectTrigger className="h-11 w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {CITATION_STYLE_IDS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {CITATION_STYLE_LABELS[id]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldError>{errors.citationStyle}</FieldError>
          </Field>

          <Field data-invalid={!!errors.researchNotes || undefined}>
            <FieldLabel htmlFor="research-notes">Notes (optional)</FieldLabel>
            <Textarea
              id="research-notes"
              value={draft.researchNotes}
              onChange={(event) => onChange({ researchNotes: event.target.value })}
              rows={4}
              aria-invalid={!!errors.researchNotes}
            />
            <FieldError>{errors.researchNotes}</FieldError>
          </Field>

          <label className="flex items-start gap-3 text-sm leading-relaxed">
            <input
              type="checkbox"
              className="mt-1 size-4 rounded border-input"
              checked={draft.allowAdditionalSources}
              onChange={(event) =>
                onChange({ allowAdditionalSources: event.target.checked })
              }
            />
            <span>
              Allow a small set of extra academic sources if they are relevant and
              verified. Your key references still take priority.
            </span>
          </label>
        </div>
      </details>
    </FieldGroup>
  );
}
