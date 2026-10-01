"use client";

import {
  calculateOrderPricing,
  formatMoneyFromMinorUnits,
  type ResearchProductConfig,
} from "@/lib/config/research-product";
import { CITATION_STYLE_LABELS, PAPER_TYPE_LABELS } from "@/lib/research/labels";
import type { ResearchDraft } from "@/lib/research/draft";

export function OrderSummary({
  draft,
  config,
  onChange,
}: {
  draft: ResearchDraft;
  config: ResearchProductConfig;
  onChange?: (patch: Partial<ResearchDraft>) => void;
}) {
  const pricing = calculateOrderPricing(draft.requestedPages, config);
  const estimate = formatMoneyFromMinorUnits(
    pricing.chargedAmountCents,
    config.currency,
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
      <article className="rounded-[16px] border border-brand-navy/10 bg-brand-white p-6 shadow-[0_12px_32px_-16px_rgba(4,46,94,0.18)]">
        <h2 className="font-heading text-xl font-semibold">{draft.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {draft.focus}
        </p>
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              Type
            </dt>
            <dd className="mt-1 font-medium">
              {PAPER_TYPE_LABELS[draft.paperType]}
            </dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              Citation style
            </dt>
            <dd className="mt-1 font-medium">
              {CITATION_STYLE_LABELS[draft.citationStyle]}
            </dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              Authors
            </dt>
            <dd className="mt-1 font-medium">
              {draft.authors.map((author) => author.name).join(", ")}
            </dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              Extra sources
            </dt>
            <dd className="mt-1 font-medium">
              {draft.allowAdditionalSources ? "Allowed" : "Key references only"}
            </dd>
          </div>
        </dl>
        <h3 className="font-heading mt-8 text-sm font-semibold">Sources</h3>
        <ol className="mt-3 space-y-2 text-sm">
          {draft.references.map((reference, index) => (
            <li key={reference.id} className="border-b border-border/70 pb-2">
              <span className="text-muted-foreground">{index + 1}. </span>
              {reference.matched?.title || reference.originalInput.trim()}
              {reference.isSystemAdded ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  Suggested extra
                </span>
              ) : null}
              {reference.isSystemAdded && onChange ? (
                <label className="mt-1 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={reference.selectedByUser !== false}
                    onChange={(event) =>
                      onChange({
                        references: draft.references.map((item) =>
                          item.id === reference.id
                            ? { ...item, selectedByUser: event.target.checked }
                            : item,
                        ),
                      })
                    }
                  />
                  Include in this order
                </label>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-muted-foreground">
          After delivery you can regenerate up to {config.regenerationLimit}{" "}
          sections. That is included in this order, not an extra line item.
        </p>
      </article>

      <aside className="h-fit rounded-[16px] border border-brand-navy/10 bg-[color-mix(in_oklch,var(--brand-navy)_5%,white)] p-6">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Estimate
        </p>
        <p className="font-heading mt-2 text-3xl font-semibold tabular-nums">
          {estimate}
        </p>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li>
            {draft.requestedPages} pages × {config.wordsPerPage} words
          </li>
          <li>{pricing.targetWords.toLocaleString()} body words (title page and bibliography excluded)</li>
          <li>
            {formatMoneyFromMinorUnits(pricing.unitPriceCents, config.currency)} per
            page, minimum{" "}
            {formatMoneyFromMinorUnits(
              pricing.minimumChargeCents,
              config.currency,
            )}{" "}
            (10 pages)
          </li>
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          This is an estimate from configured rates. The charged amount is set on
          the server at checkout.
        </p>
      </aside>
    </div>
  );
}
