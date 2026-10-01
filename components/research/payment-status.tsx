"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ACCESS_STORAGE_KEY } from "@/lib/research/draft";

function readStoredToken() {
  const stored = sessionStorage.getItem(ACCESS_STORAGE_KEY);
  if (!stored) {
    return undefined;
  }
  try {
    return (JSON.parse(stored) as { token?: string }).token;
  } catch {
    return undefined;
  }
}

export function PaymentStatus({
  paperId,
  orderId,
}: {
  paperId?: string;
  orderId?: string;
}) {
  const [status, setStatus] = useState("awaiting_payment");
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!paperId) {
      return;
    }
    const safePaperId = paperId;
    let cancelled = false;
    async function poll() {
      const token = readStoredToken();
      if (!token) {
        if (!cancelled) {
          setError("Save your recovery token from the review step, then refresh.");
        }
        return;
      }
      const response = await fetch(
        `/api/research/papers/${encodeURIComponent(safePaperId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const payload = (await response.json()) as {
        status?: string;
        message?: string;
      };
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setError(payload.message ?? "Could not load this paper.");
        return;
      }
      setError(undefined);
      setStatus(payload.status ?? "awaiting_payment");
    }

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [paperId]);

  const ready =
    status === "ready" || status === "generating" || status === "completed";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {ready
          ? "Payment is confirmed. Open the paper page when you are ready to start drafting."
          : "Processing payment. This page does not unlock the paper on its own."}
      </p>
      <p className="text-sm font-medium">Status: {status}</p>
      {orderId ? (
        <p className="text-xs text-muted-foreground">Order {orderId}</p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {ready && paperId ? (
        <Link
          href={`/research/paper/${encodeURIComponent(paperId)}`}
          className="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          Open paper draft
        </Link>
      ) : null}
      <Link
        href="/research"
        className="inline-flex h-11 items-center rounded-lg border border-border px-5 text-sm font-medium"
      >
        Back to draft
      </Link>
    </div>
  );
}
