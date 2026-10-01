import type { Metadata } from "next";
import Link from "next/link";

import { copy } from "@/lib/copy";

export const metadata: Metadata = {
  title: "Research draft privacy",
  robots: { index: false, follow: false },
};

export default function ResearchPrivacyPage() {
  const privacy = copy.research.privacy;
  return (
    <section className="px-4 py-10 md:px-8">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <h1 className="font-heading text-2xl font-semibold">{privacy.title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{privacy.intro}</p>
        <p className="text-sm leading-relaxed">{privacy.stored}</p>
        <p className="text-sm leading-relaxed">{privacy.processors}</p>
        <p className="text-sm leading-relaxed">{privacy.retention}</p>
        <p className="text-sm leading-relaxed">{privacy.pricing}</p>
        <p className="text-sm leading-relaxed">{privacy.refunds}</p>
        <p className="text-sm leading-relaxed">{privacy.ai}</p>
        <p className="text-sm">
          <Link href="/research" className="underline underline-offset-2">
            Back to the research draft
          </Link>
        </p>
      </div>
    </section>
  );
}
