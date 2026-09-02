import { Portrait } from "@/components/portrait";
import { copy } from "@/lib/copy";

export function Team() {
  return (
    <div className="mt-16 md:mt-20">
      <h3 className="text-center font-heading text-2xl font-semibold md:text-3xl">
        {copy.team.heading}
      </h3>
      <article className="mx-auto mt-10 flex max-w-2xl flex-col items-center rounded-[16px] bg-brand-white px-6 py-10 text-center shadow-[0_12px_32px_-16px_rgba(4,46,94,0.22)] md:px-12 md:py-12">
        <Portrait
          src={copy.about.founderPhoto}
          alt={`${copy.about.founderName}, ${copy.about.founderRole}`}
          initials="YA"
          sizes="176px"
          className="size-36 ring-4 ring-brand-navy/8 md:size-44"
        />
        <p className="mt-6 font-heading text-2xl font-semibold md:text-3xl">
          {copy.about.founderName}
        </p>
        <span className="mt-3 rounded-full border border-brand-navy/20 px-3 py-1 text-[11px] font-medium tracking-wide text-brand-navy uppercase">
          {copy.about.founderRole}
        </span>
        <div className="mt-6 flex max-w-[62ch] flex-col gap-4 text-left text-base leading-[1.8] text-muted-foreground">
          {copy.about.founderBio.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <a
          href={copy.footer.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 text-sm font-medium text-brand-navy underline decoration-brand-navy/25 underline-offset-4 transition-colors hover:text-brand-red hover:decoration-brand-red/40"
        >
          View LinkedIn profile
        </a>
      </article>
    </div>
  );
}
