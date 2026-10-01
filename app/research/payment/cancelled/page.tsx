import type { Metadata } from "next";

import { PaymentCancelled } from "@/components/research/payment-cancelled";

export const metadata: Metadata = {
  title: "Checkout cancelled",
  robots: { index: false, follow: false },
};

export default async function PaymentCancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ paper?: string; order?: string }>;
}) {
  const params = await searchParams;
  return (
    <section className="px-4 py-10 md:px-8">
      <div className="mx-auto w-full max-w-xl">
        <h1 className="font-heading text-2xl font-semibold">Checkout cancelled</h1>
        <div className="mt-6">
          <PaymentCancelled paperId={params.paper} orderId={params.order} />
        </div>
      </div>
    </section>
  );
}
