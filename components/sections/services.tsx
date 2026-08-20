import {
  BadgeCheckIcon,
  FolderLockIcon,
  LineChartIcon,
  MegaphoneIcon,
  PenLineIcon,
  SearchIcon,
} from "lucide-react";

import { BookCta } from "@/components/book-cta";
import { Section } from "@/components/layout/section";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

const icons = {
  pen: PenLineIcon,
  chart: LineChartIcon,
  search: SearchIcon,
  badge: BadgeCheckIcon,
  megaphone: MegaphoneIcon,
  folder: FolderLockIcon,
};

export function Services() {
  return (
    <Section
      id="services"
      className="relative isolate overflow-hidden bg-linear-to-b from-background to-[color-mix(in_oklch,var(--brand-navy)_4%,var(--background))]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(4,46,94,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(4,46,94,0.03)_1px,transparent_1px)] bg-size-[48px_48px]"
      />
      <div className="relative">
        <div className="max-w-3xl">
          <h2 className="font-heading text-3xl font-semibold md:text-4xl">
            {copy.services.heading}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            {copy.services.intro}
          </p>
        </div>
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 md:gap-8 lg:grid-cols-3">
          {copy.services.items.map((item, index) => {
            const Icon = icons[item.icon];
            const featured = index === 0;

            return (
              <li
                key={item.title}
                className={cn(
                  "relative flex h-full min-h-[22rem] flex-col overflow-hidden rounded-[16px] p-8 shadow-[0_12px_32px_-16px_rgba(4,46,94,0.22)] transition-shadow transition-transform duration-200",
                  "hover:-translate-y-1 hover:shadow-[0_20px_48px_-16px_rgba(4,46,94,0.32)]",
                  "motion-reduce:transform-none motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                  featured
                    ? "bg-[color-mix(in_oklch,var(--brand-navy)_6%,white)]"
                    : "bg-brand-white",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-0 top-0 h-[3px]",
                    index % 2 === 0 ? "bg-brand-navy" : "bg-brand-red",
                  )}
                />
                {featured ? (
                  <span className="mb-5 w-fit rounded-full border border-brand-navy/20 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-brand-navy uppercase">
                    {copy.services.featuredLabel}
                  </span>
                ) : null}
                <span
                  className={cn(
                    "mb-5 flex size-14 items-center justify-center rounded-full text-brand-navy shadow-[0_6px_16px_-6px_rgba(4,46,94,0.35)]",
                    featured ? "bg-brand-navy/15" : "bg-brand-navy/10",
                  )}
                >
                  <Icon aria-hidden className="size-8" strokeWidth={2} />
                </span>
                <h3 className="font-heading mb-3 text-xl font-semibold">
                  {item.title}
                </h3>
                <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </li>
            );
          })}
        </ul>
        <div className="mt-12 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground">{copy.services.ctaLead}</p>
          <BookCta label={copy.services.cta} />
        </div>
      </div>
    </Section>
  );
}
