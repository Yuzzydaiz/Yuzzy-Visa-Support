import { Section } from "@/components/layout/section";
import { NeedsInput } from "@/components/needs-input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { copy } from "@/lib/copy";

export function Faqs() {
  return (
    <Section id="faqs">
      <h2 className="font-heading text-3xl font-semibold md:text-4xl">
        {copy.faqs.heading}
      </h2>
      <Accordion className="mt-8" multiple={false}>
        {copy.faqs.items.map((item) => (
          <AccordionItem key={item.q} value={item.q}>
            <AccordionTrigger className="text-base">{item.q}</AccordionTrigger>
            <AccordionContent>
              {item.placeholder ? (
                <NeedsInput>{item.a}</NeedsInput>
              ) : (
                <p className="text-muted-foreground">{item.a}</p>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Section>
  );
}
