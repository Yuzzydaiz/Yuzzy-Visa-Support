import { CheckIcon } from "lucide-react";
import Image from "next/image";

import { BookCta } from "@/components/book-cta";
import { copy } from "@/lib/copy";

export function Hero() {
  return (
    <section id="home" className="relative overflow-hidden px-4 py-16 md:px-8 md:py-24">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(4,46,94,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(4,46,94,0.04)_1px,transparent_1px)] bg-size-[48px_48px]" />
        <div className="absolute -top-32 -left-24 size-[28rem] rounded-full bg-brand-navy/8 blur-3xl" />
        <div className="absolute top-16 -right-20 size-[24rem] rounded-full bg-brand-red/5 blur-3xl" />
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-6">
            <p className="inline-flex w-fit items-center rounded-full border border-brand-navy/15 bg-brand-white/70 px-3 py-1 text-[11px] font-medium tracking-[0.16em] text-brand-navy uppercase">
              {copy.hero.eyebrow}
            </p>
            <div className="flex flex-col gap-3">
              <h1 className="font-heading text-5xl leading-[1.05] font-semibold tracking-tight text-balance md:text-6xl lg:text-7xl">
                {copy.hero.headline}
              </h1>
              <p className="font-heading text-xl font-medium text-balance md:text-2xl">
                {copy.hero.kicker}
              </p>
            </div>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              {copy.hero.subheadline}
            </p>
          </div>

          <div className="flex flex-col gap-6">
            <BookCta className="h-12 rounded-xl px-6 shadow-md shadow-brand-navy/15 transition-all hover:bg-primary/90 hover:shadow-lg" />
            <dl className="grid grid-cols-1 gap-4 border-t border-brand-navy/10 pt-6 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-brand-navy/10">
              {copy.hero.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col gap-1 sm:px-4 sm:first:pl-0 sm:last:pr-0"
                >
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {stat.label}
                  </dt>
                  <dd className="font-heading text-lg font-semibold text-brand-navy tabular-nums">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="relative pb-8 pl-4 md:pb-6 md:pl-6">
          <div className="relative aspect-4/3 overflow-hidden rounded-[18px] border border-brand-navy/10 bg-card shadow-[0_24px_60px_-24px_rgba(4,46,94,0.35)]">
            <Image
              src="/brand/hero-stand-in.jpg"
              alt="Stand in atmosphere photo of professionals at work, not a real Yuzzy team portrait"
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 32rem, 100vw"
              priority
            />
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-brand-navy/40 to-transparent"
            />
          </div>
          <div className="absolute bottom-2 left-0 flex max-w-[16rem] items-center gap-3 rounded-xl border border-brand-navy/10 bg-brand-white px-3 py-2.5 shadow-md shadow-brand-navy/10 md:bottom-0 md:-left-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-navy text-brand-white">
              <CheckIcon className="size-4" aria-hidden />
            </span>
            <p className="text-sm leading-snug font-medium text-brand-navy">
              {copy.hero.imageBadge}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
