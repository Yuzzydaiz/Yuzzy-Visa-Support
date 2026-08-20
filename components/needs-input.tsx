import { cn } from "@/lib/utils";

export function NeedsInput({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-md border border-dashed border-brand-navy/30 bg-[#f3ead3] px-2 py-1 text-sm italic text-muted-foreground",
        className,
      )}
      aria-label="Awaiting Yuzzy"
    >
      {children}
    </span>
  );
}
