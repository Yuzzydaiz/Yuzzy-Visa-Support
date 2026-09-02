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

      <Team />
    </Section>
  );
}
