import type { Metadata } from "next";

import { ResearchWizard } from "@/components/research/research-wizard";
import { copy } from "@/lib/copy";
import { isResearchPublic } from "@/lib/site";

export const metadata: Metadata = {
  title: "Research paper draft",
  description: copy.research.intro,
  // Keep the pre-launch (sandbox) writer out of search results.
  ...(isResearchPublic() ? {} : { robots: { index: false, follow: false } }),
};

export default function ResearchPage() {
  return (
    <section className="px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <h1 className="font-heading text-2xl font-semibold md:text-3xl">
          {copy.research.wizard.title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {copy.research.disclosure}{" "}
          <a href="/research/privacy" className="underline underline-offset-2">
            {copy.research.wizard.privacyLink}
          </a>
        </p>
        <div className="mt-6">
          <ResearchWizard />
        </div>
      </div>
    </section>
  );
}
