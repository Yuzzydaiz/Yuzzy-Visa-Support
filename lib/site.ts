import { copy } from "@/lib/copy";

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) {
    return "http://localhost:3000";
  }
  return raw.replace(/\/$/, "");
}

export function getCalendlyUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_CALENDLY_URL?.trim();
  if (!raw) {
    return null;
  }
  return raw;
}

export function getMetadata() {
  return {
    title: copy.meta.title,
    description: copy.meta.description,
  };
}
