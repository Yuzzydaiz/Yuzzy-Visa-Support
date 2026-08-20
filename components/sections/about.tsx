import { NeedsInput } from "@/components/needs-input";
import { Portrait } from "@/components/portrait";
import { Section } from "@/components/layout/section";
import { Team } from "@/components/sections/team";
import { copy } from "@/lib/copy";

export function About() {
  return (
    <Section id="about">
      <div className="max-w-[70ch]">
        <h2 className="font-heading text-3xl font-semibold md:text-4xl">
          {copy.about.heading}
        </h2>
        <div className="mt-6 flex flex-col gap-6 text-lg leading-[1.8] text-muted-foreground">
          {copy.about.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </div>

      <article className="mt-16 grid items-center gap-8 rounded-[16px] bg-brand-white p-8 shadow-[0_12px_32px_-16px_rgba(4,46,94,0.22)] md:mt-20 md:grid-cols-[auto_1fr]">
        <Portrait
          src={copy.about.founderPhoto}
          alt="Yuzzy, Founder"
          initials="Y"
          className="size-28 text-4xl"
        />
        <div className="flex flex-col items-start gap-3">
          <h3 className="font-heading text-2xl font-semibold md:text-3xl">
            {copy.about.founderHeading}
          </h3>
          <span className="rounded-full border border-brand-navy/20 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-brand-navy uppercase">
            Founder
          </span>
          <NeedsInput>{copy.about.founderBioPlaceholder}</NeedsInput>
        </div>
      </article>

      <Team />
    </Section>
  );
}
