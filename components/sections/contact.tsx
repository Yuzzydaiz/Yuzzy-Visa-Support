"use client";

import { useState } from "react";
import { useForm, ValidationError } from "@formspree/react";

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
import { getFormspreeFormId } from "@/lib/site";

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
                <a
                  href={`mailto:${copy.contact.email}`}
                  className="font-medium text-brand-navy underline decoration-brand-red/40 underline-offset-4 transition-colors hover:text-brand-red"
                >
                  {copy.contact.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium">Phone</dt>
              <dd className="mt-1">
                <a
                  href={copy.contact.phoneHref}
                  className="font-medium text-brand-navy underline decoration-brand-red/40 underline-offset-4 transition-colors hover:text-brand-red"
                >
                  {copy.contact.phone}
                </a>
              </dd>
            </div>
          </dl>
        </div>
        <ContactForm />
      </div>
    </Section>
  );
}

function ContactForm() {
  const [state, handleSubmit] = useForm(getFormspreeFormId(), {
    data: {
      sourcePage: () =>
        typeof window === "undefined" ? "/" : window.location.pathname,
    },
  });
  const [visa, setVisa] = useState<VisaCategory | null>(null);
  const [visaError, setVisaError] = useState("");

  if (state.succeeded) {
    return (
      <p
        className="rounded-xl border border-border bg-card p-6 text-sm text-foreground"
        role="status"
      >
        {copy.contact.success}
      </p>
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!visa) {
      event.preventDefault();
      setVisaError("Choose a visa category.");
      return;
    }
    setVisaError("");
    await handleSubmit(event);
  }

  const formError = state.errors && !state.succeeded;

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-6">
      <FieldGroup>
        <input type="hidden" name="_subject" value="Yuzzy Visa Support contact" />
        <input type="hidden" name="visaCategory" value={visa ?? ""} />
        <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
          <label htmlFor="contact-gotcha">Website</label>
          <input
            id="contact-gotcha"
            type="text"
            name="_gotcha"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <Field>
          <FieldLabel htmlFor="contact-name">Name</FieldLabel>
          <Input
            id="contact-name"
            name="name"
            autoComplete="name"
            required
          />
          <ValidationError
            field="name"
            errors={state.errors}
            className="text-sm text-destructive"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="contact-email">Email</FieldLabel>
          <Input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <ValidationError
            field="email"
            errors={state.errors}
            className="text-sm text-destructive"
          />
        </Field>
        <Field data-invalid={visaError ? true : undefined}>
          <FieldLabel>Visa category</FieldLabel>
          <Select
            value={visa ?? null}
            onValueChange={(value) => {
              setVisa(value as VisaCategory);
              setVisaError("");
            }}
          >
            <SelectTrigger className="w-full" aria-invalid={!!visaError}>
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
          <FieldError>{visaError}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="contact-message">Message</FieldLabel>
          <Textarea
            id="contact-message"
            name="message"
            rows={5}
            required
          />
          <ValidationError
            field="message"
            errors={state.errors}
            className="text-sm text-destructive"
          />
        </Field>
        <Button type="submit" disabled={state.submitting} className="h-11">
          {state.submitting ? "Sending…" : "Send message"}
        </Button>
        <p className="sr-only" aria-live="polite">
          {state.succeeded ? copy.contact.success : ""}
          {formError ? copy.contact.error : ""}
        </p>
        {formError ? (
          <ValidationError
            errors={state.errors}
            className="text-sm text-destructive"
          />
        ) : null}
      </FieldGroup>
    </form>
  );
}
