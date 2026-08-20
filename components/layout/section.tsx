import { cn } from "@/lib/utils";

export function Section({
  id,
  children,
  className,
  tone = "paper",
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
  tone?: "paper" | "surface";
}) {
  return (
    <section
      id={id}
      className={cn(
        "px-4 py-16 md:px-8 md:py-24",
        tone === "surface" && "bg-card",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}
