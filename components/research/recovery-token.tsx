"use client";

import { useState } from "react";

import { ACCESS_STORAGE_KEY } from "@/lib/research/draft";

export function readStoredToken(): string | undefined {
  try {
    const stored = sessionStorage.getItem(ACCESS_STORAGE_KEY);
    if (!stored) {
      return undefined;
    }
    return (JSON.parse(stored) as { token?: string }).token;
  } catch {
    return undefined;
  }
}

export function storeAccessToken(input: {
  token: string;
  paperPublicId: string;
  orderPublicId?: string;
}) {
  try {
    sessionStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(input));
  } catch {
    /* storage unavailable */
  }
}

// Lets a returning customer (new tab, new browser, cleared session) paste the
// recovery token shown at checkout instead of being locked out of their paper.
export function RecoveryTokenForm({
  paperPublicId,
  onSaved,
}: {
  paperPublicId: string;
  onSaved: () => void;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="space-y-2 rounded-xl border border-border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const token = value.trim();
        if (!token) {
          return;
        }
        storeAccessToken({ token, paperPublicId });
        setValue("");
        onSaved();
      }}
    >
      <label htmlFor="recovery-token" className="text-sm font-medium">
        Recovery token
      </label>
      <p className="text-xs text-muted-foreground">
        Paste the token shown when you started checkout.
      </p>
      <input
        id="recovery-token"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoComplete="off"
        spellCheck={false}
        className="h-11 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm"
      />
      <button
        type="submit"
        className="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
      >
        Open paper
      </button>
    </form>
  );
}
