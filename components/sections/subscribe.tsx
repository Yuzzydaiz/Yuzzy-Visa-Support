"use client";

import { useState } from "react";
import { useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";

export function Subscribe() {
  return (
    <Section tone="surface">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="font-heading text-3xl font-semibold">{copy.subscribe.heading}</h2>
        <p className="mt-4 text-muted-foreground">{copy.subscribe.body}</p>
        {process.env.NEXT_PUBLIC_CONVEX_URL ? (
          <SubscribeForm />
        ) : (
          <p className="mt-8 text-sm text-muted-foreground">
            Subscribe connects once Convex is configured.
          </p>
        )}
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          {copy.subscribe.disclaimer}
        </p>
      </div>
    </Section>
  );
}

function SubscribeForm() {
  const subscribe = useMutation(api.subscribers.subscribe);
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email.");
      setStatus("idle");
      return;
    }
    setError("");
    setPending(true);
    setStatus("idle");
    try {
      await subscribe({ email: email.trim(), website });
      setStatus("success");
      setEmail("");
      setWebsite("");
    } catch {
      setStatus("error");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="mt-8">
        <FieldGroup>
          <Field className="sm:flex-row sm:items-end" data-invalid={!!error || undefined}>
            <div className="flex-1">
              <FieldLabel htmlFor="subscribe-email">Email</FieldLabel>
              <Input
                id="subscribe-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                aria-invalid={!!error}
              />
            </div>
            <Button type="submit" disabled={pending} className="h-11 sm:w-auto">
              {pending ? "Joining…" : "Subscribe"}
            </Button>
          </Field>
          <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
            <label htmlFor="subscribe-website">Website</label>
            <input
              id="subscribe-website"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
          <FieldError>{error}</FieldError>
        </FieldGroup>
      </form>
      <p className="sr-only" aria-live="polite">
        {status === "success" ? copy.subscribe.success : ""}
        {status === "error" ? copy.subscribe.error : ""}
      </p>
      {status === "success" ? (
        <p className="mt-3 text-sm">{copy.subscribe.success}</p>
      ) : null}
      {status === "error" ? (
        <p className="mt-3 text-sm text-destructive">{copy.subscribe.error}</p>
      ) : null}
    </>
  );
}
