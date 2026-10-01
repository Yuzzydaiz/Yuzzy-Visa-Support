import type { Metadata } from "next";
import { Suspense } from "react";

import { PaperProgress } from "@/components/research/paper-progress";

export const metadata: Metadata = {
  title: "Paper draft",
  robots: { index: false, follow: false },
};

export default async function ResearchPaperPage({
  params,
}: {
  params: Promise<{ paperId: string }>;
}) {
  const { paperId } = await params;
  return (
    <section className="px-4 py-10 md:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <PaperProgress paperId={paperId} />
        </Suspense>
      </div>
    </section>
  );
}
