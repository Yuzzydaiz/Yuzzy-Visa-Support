"use client";

import Image from "next/image";
import { ChevronLeftIcon, ChevronRightIcon, ExpandIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Review = {
  src: string;
  width: number;
  height: number;
  alt: string;
};

export function ReviewGallery({ reviews }: { reviews: readonly Review[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const carouselRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const close = useCallback(() => {
    setActiveIndex((current) => {
      if (current !== null) {
        window.requestAnimationFrame(() => triggerRefs.current[current]?.focus());
      }
      return null;
    });
  }, []);

  const showPrevious = useCallback(() => {
    setActiveIndex((current) =>
      current === null ? null : (current - 1 + reviews.length) % reviews.length,
    );
  }, [reviews.length]);

  const showNext = useCallback(() => {
    setActiveIndex((current) =>
      current === null ? null : (current + 1) % reviews.length,
    );
  }, [reviews.length]);

  useEffect(() => {
    if (activeIndex === null) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") showPrevious();
      if (event.key === "ArrowRight") showNext();

      if (event.key === "Tab" && dialogRef.current) {
        const controls = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (controls.length === 0) {
          event.preventDefault();
          dialogRef.current.focus();
          return;
        }
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === dialogRef.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activeIndex, close, showNext, showPrevious]);

  const activeReview = activeIndex === null ? null : reviews[activeIndex];

  function scrollCarousel(direction: -1 | 1) {
    const carousel = carouselRef.current;
    if (!carousel) return;
    const firstCard = triggerRefs.current[0];
    const gap = Number.parseFloat(window.getComputedStyle(carousel).columnGap) || 0;
    carousel.scrollBy({
      left: direction * ((firstCard?.offsetWidth ?? carousel.clientWidth * 0.85) + gap),
      behavior: "smooth",
    });
  }

  return (
    <>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => scrollCarousel(-1)}
          className="grid size-11 place-items-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:border-brand-navy/35 hover:bg-muted"
          aria-label="Scroll reviews left"
        >
          <ChevronLeftIcon className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => scrollCarousel(1)}
          className="grid size-11 place-items-center rounded-full bg-brand-navy text-brand-white shadow-sm transition-colors hover:bg-brand-navy/90"
          aria-label="Scroll reviews right"
        >
          <ChevronRightIcon className="size-5" />
        </button>
      </div>

      <div
        ref={carouselRef}
        role="region"
        aria-label="Client reviews carousel"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            scrollCarousel(-1);
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            scrollCarousel(1);
          }
        }}
        className="review-carousel -mx-4 mt-4 grid auto-cols-[88vw] snap-x snap-mandatory grid-flow-col grid-rows-3 gap-4 overflow-x-auto px-4 pb-5 sm:auto-cols-[76vw] sm:gap-5 md:-mx-8 md:px-8 lg:auto-cols-[56vw]"
      >
        {reviews.map((review, index) => (
          <button
            key={review.src}
            ref={(node) => {
              triggerRefs.current[index] = node;
            }}
            type="button"
            onClick={() => setActiveIndex(index)}
            aria-label={`Open review ${index + 1} of ${reviews.length}`}
            className="group relative h-48 w-full snap-start overflow-hidden rounded-2xl border border-border bg-card p-2 text-left shadow-[0_14px_35px_-28px_var(--brand-navy)] transition duration-300 hover:-translate-y-1 hover:border-brand-navy/35 hover:shadow-[0_22px_45px_-28px_var(--brand-navy)] sm:h-52 lg:h-56"
          >
            <span className="relative block h-full w-full overflow-hidden rounded-xl bg-brand-white">
              <Image
                src={review.src}
                fill
                alt={review.alt}
                sizes="(min-width: 1024px) 56vw, (min-width: 640px) 76vw, 88vw"
                className="object-contain"
              />
            </span>
            <span className="absolute right-4 bottom-4 grid size-11 place-items-center rounded-full bg-brand-navy text-brand-white shadow-lg transition-transform group-hover:scale-105" aria-hidden>
              <ExpandIcon className="size-5" />
            </span>
          </button>
        ))}
      </div>

      {activeReview && activeIndex !== null ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-brand-navy/90 p-3 backdrop-blur-sm md:p-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            if (touchStartX.current === null) return;
            const distance = event.changedTouches[0].clientX - touchStartX.current;
            touchStartX.current = null;
            if (Math.abs(distance) < 50) return;
            if (distance > 0) showPrevious();
            else showNext();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-dialog-title"
            tabIndex={-1}
            className="relative flex max-h-full w-full max-w-6xl flex-col rounded-2xl bg-card p-3 shadow-2xl outline-none md:p-5"
          >
            <div className="mb-3 flex items-center justify-between gap-4 px-1">
              <div>
                <h3 id="review-dialog-title" className="font-heading text-base font-semibold md:text-lg">
                  Client review
                </h3>
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {activeIndex + 1} of {reviews.length}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="grid size-11 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted"
                aria-label="Close review viewer"
              >
                <XIcon className="size-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-xl bg-brand-white">
              <Image
                src={activeReview.src}
                width={activeReview.width}
                height={activeReview.height}
                alt={activeReview.alt}
                sizes="100vw"
                priority
                className="mx-auto h-auto max-h-[70vh] w-auto max-w-full object-contain"
              />
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={showPrevious}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
                aria-label="Show previous review"
              >
                <ChevronLeftIcon className="size-5" />
                <span className="hidden sm:inline">Previous</span>
              </button>
              <p className="text-center text-xs text-muted-foreground sm:text-sm">
                Use arrow keys or swipe to browse
              </p>
              <button
                type="button"
                onClick={showNext}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
                aria-label="Show next review"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRightIcon className="size-5" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
