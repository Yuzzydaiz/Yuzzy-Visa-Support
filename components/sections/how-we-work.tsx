import { Section } from "@/components/layout/section";
import { copy } from "@/lib/copy";

export function HowWeWork() {
  return (
    <Section className="relative bg-[color-mix(in_oklch,var(--brand-navy)_3%,var(--background))]">
      <h2 className="font-heading text-3xl font-semibold md:text-4xl">
        {copy.process.heading}
      </h2>
      <div className="relative mt-12">
        <div
          aria-hidden
          className="pointer-events-none absolute top-8 bottom-8 left-1/2 -translate-x-1/2 border-l border-dashed border-brand-navy/25 md:hidden"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-8 right-[16%] left-[16%] hidden border-t border-dashed border-brand-navy/25 md:top-9 md:block"
        />
        <ol className="grid gap-6 md:grid-cols-3 md:gap-8">
          {copy.process.steps.map((step) => (
            <li key={step.n} className="flex h-full flex-col gap-6">
              <div className="relative z-10 flex justify-center">
                <span className="flex size-16 items-center justify-center rounded-full border border-brand-navy/15 bg-brand-white md:size-[4.5rem]">
                  <span className="font-heading text-4xl font-semibold text-brand-navy tabular-nums md:text-5xl">
                    {step.n}
                  </span>
                </span>
              </div>
              <article
                className="flex h-full min-h-[14rem] flex-col rounded-[16px] bg-brand-white p-8 shadow-[0_12px_32px_-16px_rgba(4,46,94,0.22)] transition-shadow transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_20px_48px_-16px_rgba(4,46,94,0.32)] motion-reduce:transform-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <h3 className="font-heading text-2xl font-semibold md:text-3xl">
                  {step.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
