"use client";

import Link from "next/link";
import { useState } from "react";

import {
  RecoveryTokenForm,
  readStoredToken,
} from "@/components/research/recovery-token";

export function PaymentCancelled({
  paperId,
  orderId,
}: {
  paperId?: string;
  orderId?: string;
}) {
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [needsToken, setNeedsToken] = useState(false);

  async function retry() {
    if (!paperId || !orderId) {
      setError("Missing order details.");
      return;
    }
    const token = readStoredToken();
    if (!token) {
      setError("Enter the recovery token from the review step, then retry.");
      setNeedsToken(true);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/research/orders/retry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paperPublicId: paperId,
          orderPublicId: orderId,
          token: token,
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
      {needsToken && paperId ? (
        <RecoveryTokenForm
          paperPublicId={paperId}
          onSaved={() => {
            setNeedsToken(false);
            setError(undefined);
          }}
        />
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
