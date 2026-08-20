import { Section } from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import { copy } from "@/lib/copy";

export function Reviews() {
  return (
    <Section id="reviews" tone="surface">
      <h2 className="font-heading text-3xl font-semibold md:text-4xl">
        {copy.reviews.heading}
      </h2>
      <p className="mt-4 text-lg text-muted-foreground">{copy.reviews.trustLine}</p>
      <ul className="mt-8 flex flex-wrap gap-2">
        {copy.reviews.caseTypes.map((item) => (
          <li key={item}>
            <Badge variant="outline" className="px-3 py-1 text-sm">
              {item}
            </Badge>
          </li>
        ))}
      </ul>
    </Section>
  );
}
