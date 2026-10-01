import Link from "next/link";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

export function ResearchAssistant() {
  return (
    <Section id={copy.research.sectionId} tone="surface">
      <div className="max-w-3xl">
        <p className="text-[11px] font-medium tracking-[0.16em] text-brand-navy uppercase">
          {copy.research.eyebrow}
        </p>
        <h2 className="font-heading mt-3 text-3xl font-semibold md:text-4xl">
          {copy.research.heading}
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          {copy.research.intro}
        </p>
      </div>
      <ul className="mt-12 grid gap-6 md:grid-cols-3">
        {copy.research.facts.map((fact) => (
          <li
            key={fact.title}
            className="rounded-[16px] border border-brand-navy/10 bg-brand-white p-6 shadow-[0_12px_32px_-16px_rgba(4,46,94,0.18)]"
          >
            <h3 className="font-heading text-lg font-semibold">{fact.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {fact.body}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Button
          nativeButton={false}
          render={<Link href="/research" />}
          className="h-12 rounded-xl px-6 shadow-md shadow-brand-navy/15"
        >
          {copy.research.cta}
        </Button>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          {copy.research.disclosure}
        </p>
      </div>
    </Section>
  );
}
