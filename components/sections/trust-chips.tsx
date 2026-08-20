import { Section } from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import { copy } from "@/lib/copy";

export function TrustChips() {
  return (
    <Section className="py-8 md:py-10" tone="surface">
      <ul className="flex flex-wrap items-center justify-center gap-2">
        {copy.trustChips.map((chip) => (
          <li key={chip}>
            <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">
              {chip}
            </Badge>
          </li>
        ))}
      </ul>
    </Section>
  );
}
