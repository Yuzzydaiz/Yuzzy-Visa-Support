"use client";

import { useState } from "react";
import { useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import { NeedsInput } from "@/components/needs-input";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/lib/copy";

type VisaCategory = "EB1A" | "O1" | "EB2_NIW";

export function Contact() {
  return (
    <Section id="contact">
      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <h2 className="font-heading text-3xl font-semibold md:text-4xl">
            {copy.contact.heading}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{copy.contact.body}</p>
          <dl className="mt-8 flex flex-col gap-4">
            <div>
              <dt className="text-sm font-medium">Email</dt>
              <dd className="mt-1">
                <NeedsInput>{copy.contact.emailPlaceholder}</NeedsInput>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium">Phone</dt>
              <dd className="mt-1">
                <NeedsInput>{copy.contact.phonePlaceholder}</NeedsInput>
              </dd>
            </div>
          </dl>
        </div>
        {process.env.NEXT_PUBLIC_CONVEX_URL ? (
          <ContactForm />
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            The contact form connects once Convex is configured.
          </p>
        )}
      </div>
    </Section>
  );
}

function ContactForm() {
  const submit = useMutation(api.contact.submit);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [visa, setVisa] = useState<VisaCategory | null>(null);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "Name is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "Enter a valid email.";
    }
    if (!visa) nextErrors.visa = "Choose a visa category.";
    if (!message.trim()) nextErrors.message = "Message is required.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStatus("idle");
      return;
    }

    setPending(true);
    setStatus("idle");
    try {
      await submit({
        name: name.trim(),
        email: email.trim(),
        visaCategory: visa as VisaCategory,
        message: message.trim(),
        website,
        sourcePage:
          typeof window === "undefined" ? undefined : window.location.pathname,
        userAgent:
          typeof navigator === "undefined" ? undefined : navigator.userAgent,
      });
      setStatus("success");
      setName("");
      setEmail("");
      setVisa(null);
      setMessage("");
      setWebsite("");
    } catch {
      setStatus("error");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-xl border border-border bg-card p-6">
      <FieldGroup>
        <Field data-invalid={!!fieldErrors.name || undefined}>
          <FieldLabel htmlFor="contact-name">Name</FieldLabel>
          <Input
            id="contact-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
            aria-invalid={!!fieldErrors.name}
          />
          <FieldError>{fieldErrors.name}</FieldError>
        </Field>
        <Field data-invalid={!!fieldErrors.email || undefined}>
          <FieldLabel htmlFor="contact-email">Email</FieldLabel>
          <Input
            id="contact-email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            aria-invalid={!!fieldErrors.email}
          />
          <FieldError>{fieldErrors.email}</FieldError>
        </Field>
        <Field data-invalid={!!fieldErrors.visa || undefined}>
          <FieldLabel>Visa category</FieldLabel>
          <Select
            value={visa ?? null}
            onValueChange={(value) => setVisa(value as VisaCategory)}
          >
            <SelectTrigger className="w-full" aria-invalid={!!fieldErrors.visa}>
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {copy.contact.visaOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldError>{fieldErrors.visa}</FieldError>
        </Field>
        <Field data-invalid={!!fieldErrors.message || undefined}>
          <FieldLabel htmlFor="contact-message">Message</FieldLabel>
          <Textarea
            id="contact-message"
            name="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            required
            aria-invalid={!!fieldErrors.message}
          />
          <FieldError>{fieldErrors.message}</FieldError>
        </Field>
        <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
          <label htmlFor="contact-website">Website</label>
          <input
            id="contact-website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={pending} className="h-11">
          {pending ? "Sending…" : "Send message"}
        </Button>
        <p className="sr-only" aria-live="polite">
          {status === "success" ? copy.contact.success : ""}
          {status === "error" ? copy.contact.error : ""}
        </p>
        {status === "success" ? (
          <p className="text-sm text-foreground">{copy.contact.success}</p>
        ) : null}
        {status === "error" ? (
          <p className="text-sm text-destructive">{copy.contact.error}</p>
        ) : null}
      </FieldGroup>
    </form>
  );
}
