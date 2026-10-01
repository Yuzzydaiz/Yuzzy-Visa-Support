"use client";

import { useEffect, useId, useRef, useState } from "react";

import { copy } from "@/lib/copy";

function WhatsAppMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.74.46 3.44 1.34 4.94L2 22l5.39-1.41a10.05 10.05 0 0 0 4.65 1.18h.04c5.46 0 9.89-4.4 9.89-9.84C21.97 6.4 17.5 2 12.04 2Zm5.77 14.14c-.24.67-1.4 1.24-1.94 1.32-.5.07-1.13.1-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.26-4.78-4.18-4.93-4.38-.14-.2-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.27-.29.58-.36.78-.36h.56c.18 0 .42-.07.66.5.24.58.82 2 .89 2.15.07.14.12.31.02.5-.1.2-.14.31-.29.48-.14.16-.3.36-.43.49-.14.14-.29.29-.12.56.16.27.72 1.19 1.55 1.93 1.07.95 1.97 1.25 2.24 1.39.27.14.43.12.59-.07.16-.2.67-.78.85-1.05.18-.27.36-.22.6-.13.24.09 1.53.72 1.79.85.27.13.44.2.51.31.07.11.07.64-.17 1.31Z" />
    </svg>
  );
}

export function WhatsAppButton() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const { whatsapp } = copy.contact;

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3 md:right-6 md:bottom-6">
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={whatsapp.heading}
          className="w-[min(20.5rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-4 shadow-xl"
        >
          <p className="font-heading text-base font-semibold text-foreground">
            {whatsapp.heading}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {whatsapp.body}
          </p>
          <a
            href={whatsapp.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1ebe5d]"
          >
            <WhatsAppMark className="size-5" />
            {whatsapp.cta}
          </a>
        </div>
      ) : null}

      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={whatsapp.launcherLabel}
        onClick={() => setOpen((current) => !current)}
        className="flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 hover:bg-[#1ebe5d] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#25D366]/50"
      >
        <WhatsAppMark className="size-7" />
      </button>
    </div>
  );
}
