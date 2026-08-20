import { Button } from "@/components/ui/button";
import { bookLabel } from "@/lib/navigation";
import { getCalendlyUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

export function BookCta({
  label = bookLabel,
  className,
}: {
  label?: string;
  className?: string;
}) {
  const url = getCalendlyUrl();

  if (!url) {
    return (
      <Button
        nativeButton={false}
        render={<a href="#contact" />}
        className={cn("h-11 px-5 text-sm", className)}
        aria-label={`${label}. Booking link is not set yet, so this jumps to contact.`}
      >
        {label}
      </Button>
    );
  }

  return (
    <Button
      nativeButton={false}
      render={
        <a href={url} target="_blank" rel="noopener noreferrer" />
      }
      className={cn("h-11 px-5 text-sm", className)}
    >
      {label}
    </Button>
  );
}
