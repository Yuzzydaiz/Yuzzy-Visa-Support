import { Section } from "@/components/layout/section";
import { ReviewGallery } from "@/components/review-gallery";
import { copy } from "@/lib/copy";

export function Reviews() {
  return (
    <Section id="reviews" tone="surface">
      <h2 className="font-heading text-3xl font-semibold md:text-4xl">
        {copy.reviews.heading}
      </h2>
      <p className="mt-4 text-lg text-muted-foreground">{copy.reviews.trustLine}</p>
      <p className="mt-2 text-sm text-muted-foreground">{copy.reviews.viewerHint}</p>
      <ReviewGallery reviews={copy.reviews.items} />
    </Section>
  );
}
