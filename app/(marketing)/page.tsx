import { Hero } from "@/components/sections/hero";
import { TrustChips } from "@/components/sections/trust-chips";
import { Services } from "@/components/sections/services";
import { HowWeWork } from "@/components/sections/how-we-work";
import { About } from "@/components/sections/about";
import { Reviews } from "@/components/sections/reviews";
import { Faqs } from "@/components/sections/faqs";
import { Contact } from "@/components/sections/contact";
import { Subscribe } from "@/components/sections/subscribe";
import { copy } from "@/lib/copy";
import { getSiteUrl } from "@/lib/site";

function JsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: copy.brand.name,
    description: copy.meta.description,
    url: getSiteUrl(),
    serviceType: "EB1A, O1, and NIW profile building",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default function HomePage() {
  return (
    <>
      <JsonLd />
      <Hero />
      <TrustChips />
      <Services />
      <HowWeWork />
      <About />
      <Reviews />
      <Faqs />
      <Contact />
      <Subscribe />
    </>
  );
}
