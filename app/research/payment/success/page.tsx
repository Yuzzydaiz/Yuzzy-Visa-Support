import type { Metadata } from "next";

import { PaymentStatus } from "@/components/research/payment-status";

export const metadata: Metadata = {
  title: "Processing payment",
  robots: { index: false, follow: false },
};

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ paper?: string; order?: string }>;
}) {
  const params = await searchParams;
  return (
    <section className="px-4 py-10 md:px-8">
      <div className="mx-auto w-full max-w-xl">
        <h1 className="font-heading text-2xl font-semibold">Processing payment</h1>
        <div className="mt-6">
          <PaymentStatus paperId={params.paper} orderId={params.order} />
        </div>
      </div>
    </section>
  );
}
