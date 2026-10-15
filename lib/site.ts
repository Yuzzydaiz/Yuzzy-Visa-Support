import { copy } from "@/lib/copy";

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) {
    return "http://localhost:3000";
  }
  return raw.replace(/\/$/, "");
}

const DEFAULT_CALENDLY_URL = "https://calendly.com/yusufayomide267/30min";
const DEFAULT_FORMSPREE_ID = "mwlkbqoe";

export function getCalendlyUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_CALENDLY_URL?.trim();
  if (raw) {
    return raw;
  }
  return DEFAULT_CALENDLY_URL;
}

export function getFormspreeFormId(): string {
  return process.env.NEXT_PUBLIC_FORMSPREE_ID?.trim() || DEFAULT_FORMSPREE_ID;
}

// The research writer is reachable by direct link for testing, but its
// homepage, footer, and sitemap entry points appear only once it is launched
// (NEXT_PUBLIC_RESEARCH_PUBLIC=true, set together with the live Bachs keys).
export function isResearchPublic(): boolean {
  return process.env.NEXT_PUBLIC_RESEARCH_PUBLIC?.trim().toLowerCase() === "true";
}

export function getMetadata() {
  return {
    title: copy.meta.title,
    description: copy.meta.description,
  };
}
