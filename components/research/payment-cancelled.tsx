"use client";

import Link from "next/link";
import { useState } from "react";

import { ACCESS_STORAGE_KEY } from "@/lib/research/draft";

export function PaymentCancelled({
  paperId,
  orderId,
}: {
  paperId?: string;
  orderId?: string;
}) {
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function retry() {
    if (!paperId || !orderId) {
      setError("Missing order details.");
      return;
    }
    const stored = sessionStorage.getItem(ACCESS_STORAGE_KEY);
    const parsed = stored
      ? (JSON.parse(stored) as { token?: string })
      : undefined;
    if (!parsed?.token) {
      setError("Save your recovery token from the review step, then retry.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/research/orders/retry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${parsed.token}`,
        },
        body: JSON.stringify({
          paperPublicId: paperId,
          orderPublicId: orderId,
          token: parsed.token,
        }),
      });
      const payload = (await response.json()) as {
        checkoutUrl?: string;
        message?: string;
      };
      if (!response.ok || !payload.checkoutUrl) {
        setError(payload.message ?? "Could not restart checkout.");
        return;
      }
      window.location.assign(payload.checkoutUrl);
    } catch {
      setError("Could not restart checkout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Payment was cancelled. The unpaid draft is still saved. You can try
        checkout again without creating a second paid order.
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          disabled={busy}
          onClick={() => {
            void retry();
          }}
        >
          {busy ? "Restarting…" : "Retry checkout"}
        </button>
        <Link
          href="/research"
          className="inline-flex h-11 items-center rounded-lg border border-border px-5 text-sm font-medium"
        >
          Back to draft
        </Link>
      </div>
    </div>
  );
}
