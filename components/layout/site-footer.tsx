import { MailIcon, PhoneIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { BookCta } from "@/components/book-cta";
import { NeedsInput } from "@/components/needs-input";
import { copy } from "@/lib/copy";
import { navItems } from "@/lib/navigation";

function LinkedInMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="2" />
      <path d="M8 10.5V16.5" />
      <path d="M8 7.5v.01" />
      <path d="M12 16.5v-4c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5v4" />
      <path d="M12 12.5V10.5" />
    </svg>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[color-mix(in_oklch,var(--brand-navy)_10%,var(--background))] px-4 py-16 md:px-8 md:py-20">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Image
              src="/brand/yuzzy-logo.png"
              alt={copy.brand.name}
              width={160}
              height={72}
              className="h-10 w-auto"
            />
            <p className="mt-3 text-sm text-muted-foreground">
              {copy.brand.tagline}
            </p>
            <div className="mt-4 flex items-center gap-2">
              {copy.footer.linkedin ? (
                <a
                  href={copy.footer.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-navy/70 transition-colors hover:text-brand-navy"
                >
                  <LinkedInMark className="size-5" />
                  <span className="sr-only">LinkedIn</span>
                </a>
              ) : (
                <>
                  <LinkedInMark className="size-5 text-brand-navy/70" />
                  <NeedsInput>{copy.footer.linkedinPlaceholder}</NeedsInput>
                </>
              )}
            </div>
          </div>

          <nav aria-label="Footer">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {copy.footer.quickLinks}
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {navItems.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.hash}
                    className="text-sm font-medium text-foreground/80 transition-colors hover:text-brand-navy"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {copy.footer.contactHeading}
            </p>
            <ul className="mt-3 flex flex-col gap-3">
              <li className="flex items-center gap-2">
                <MailIcon
                  className="size-4 shrink-0 text-brand-navy"
                  strokeWidth={1.75}
                  aria-hidden
                />
                {copy.contact.email ? (
                  <a
                    href={`mailto:${copy.contact.email}`}
                    className="text-sm text-foreground/80 transition-colors hover:text-brand-navy"
                  >
                    {copy.contact.email}
                  </a>
                ) : (
                  <NeedsInput>{copy.contact.emailPlaceholder}</NeedsInput>
                )}
              </li>
              <li className="flex items-center gap-2">
                <PhoneIcon
                  className="size-4 shrink-0 text-brand-navy"
                  strokeWidth={1.75}
                  aria-hidden
                />
                {copy.contact.phone ? (
                  <a
                    href={`tel:${copy.contact.phone.replace(/\s+/g, "")}`}
                    className="text-sm text-foreground/80 transition-colors hover:text-brand-navy"
                  >
                    {copy.contact.phone}
                  </a>
                ) : (
                  <NeedsInput>{copy.contact.phonePlaceholder}</NeedsInput>
                )}
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {copy.footer.ctaHeading}
            </p>
            <p className="mt-3 mb-4 text-sm text-muted-foreground">
              {copy.footer.ctaLead}
            </p>
            <BookCta />
          </div>
        </div>

        <div className="mt-12 border-t border-brand-navy/15 pt-8">
          <p className="max-w-4xl text-xs leading-relaxed text-muted-foreground">
            {copy.footer.disclaimer}
          </p>
          <p className="mt-3 text-[11px] text-muted-foreground/80">
            © {year} {copy.brand.name}
          </p>
        </div>
      </div>
    </footer>
  );
}
