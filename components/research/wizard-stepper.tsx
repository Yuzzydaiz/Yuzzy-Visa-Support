"use client";

import { cn } from "@/lib/utils";
import {
  ACTIVE_STEPS,
  type ActiveWizardStep,
} from "@/lib/research/draft";

const LABELS: Record<ActiveWizardStep, string> = {
  details: "Details",
  sources: "References",
  review: "Review",
};

export function WizardStepper({
  current,
  onSelect,
  allowUpcoming = false,
}: {
  current: ActiveWizardStep;
  onSelect: (step: ActiveWizardStep) => void;
  allowUpcoming?: boolean;
}) {
  const currentIndex = ACTIVE_STEPS.indexOf(current);

  return (
    <nav aria-label="Draft steps">
      <ol className="flex gap-1 lg:flex-col">
        {ACTIVE_STEPS.map((id, index) => {
          const isCurrent = id === current;
          const done = index < currentIndex;
          const upcoming = index > currentIndex;
          const selectable = !upcoming || allowUpcoming;

          return (
            <li key={id} className="min-w-0 flex-1 lg:flex-none">
              <button
                type="button"
                disabled={!selectable}
                onClick={() => {
                  if (selectable) {
                    onSelect(id);
                  }
                }}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors lg:justify-start",
                  isCurrent && "bg-brand-navy/8 text-brand-navy",
                  done && "text-brand-navy",
                  upcoming && "text-muted-foreground",
                  selectable && "hover:bg-brand-navy/5",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium",
                    isCurrent &&
                      "border-brand-navy bg-brand-navy text-brand-white",
                    done && "border-brand-navy/40 bg-brand-white",
                    upcoming && "border-border",
                  )}
                  aria-hidden
                >
                  {index + 1}
                </span>
                <span className="truncate font-medium">{LABELS[id]}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
