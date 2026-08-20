import Image from "next/image";

import { cn } from "@/lib/utils";

export function Portrait({
  src,
  alt,
  initials,
  className,
}: {
  src?: string;
  alt: string;
  initials: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-navy font-heading text-brand-white shadow-[0_6px_16px_-6px_rgba(4,46,94,0.35)] ring-2 ring-brand-navy/10",
        className,
      )}
    >
      {src ? (
        <Image src={src} alt={alt} fill className="object-cover" sizes="112px" />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </span>
  );
}
