"use client";

import Image from "next/image";
import { useState } from "react";

import { copy } from "@/lib/copy";

export function Team() {
  const [expanded, setExpanded] = useState(false);
  const [preview, ...rest] = copy.about.founderBio;

  return (
    <article className="mt-16 overflow-hidden rounded-[16px] bg-brand-white shadow-[0_12px_32px_-16px_rgba(4,46,94,0.22)] md:mt-20">
      <div className="grid gap-0 md:grid-cols-[5fr_7fr] lg:grid-cols-[2fr_3fr]">
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-gradient-to-br from-brand-navy/5 to-brand-navy/10 md:aspect-auto md:min-h-[400px] lg:min-h-[480px]">
          <Image
            src={copy.about.founderPhoto}
            alt={`${copy.about.founderName}, ${copy.about.founderRole}`}
            fill
            className="object-cover object-center transition-transform duration-700 hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
            sizes="(min-width: 768px) 40vw, 100vw"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-navy/10 via-transparent to-transparent" />
          <div className="absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-brand-red via-brand-red to-brand-navy" />
        </div>

        <div className="flex flex-col justify-center gap-6 p-8 sm:p-10 lg:p-12 xl:p-14">
          <div className="flex flex-col gap-3">
            <span className="inline-flex w-fit items-center rounded-full bg-brand-navy/5 px-3 py-1 text-xs font-semibold tracking-wider text-brand-navy uppercase">
              {copy.about.founderRole}
            </span>
            <h3 className="font-heading text-3xl leading-tight font-semibold text-ink sm:text-4xl lg:text-[2.5rem]">
              {copy.about.founderName}
            </h3>
            <div className="flex items-center gap-3">
              <div className="h-[3px] w-12 rounded-full bg-gradient-to-r from-brand-red to-brand-navy" />
              <div className="h-[3px] w-8 rounded-full bg-brand-navy/20" />
            </div>
          </div>

          <div className="flex flex-col gap-4 text-base leading-[1.8] text-muted-foreground sm:text-lg">
            <p>{preview}</p>
            {rest.map((p) => (
              <p key={p} hidden={!expanded}>
                {p}
              </p>
            ))}
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((open) => !open)}
              className="self-start text-sm font-medium text-brand-navy underline decoration-brand-navy/25 underline-offset-4 transition-colors hover:text-brand-red hover:decoration-brand-red/40"
            >
              {expanded ? "Read less" : "Read more"}
            </button>
          </div>

          <a
            href={copy.footer.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start text-sm font-medium text-brand-navy underline decoration-brand-navy/25 underline-offset-4 transition-colors hover:text-brand-red hover:decoration-brand-red/40"
          >
            View LinkedIn profile
          </a>
        </div>
      </div>
    </article>
  );
}
