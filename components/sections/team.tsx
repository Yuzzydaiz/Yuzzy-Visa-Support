import { NeedsInput } from "@/components/needs-input";
import { Portrait } from "@/components/portrait";
import { copy } from "@/lib/copy";

export function Team() {
  return (
    <div className="mt-16 md:mt-20">
      <h3 className="font-heading text-2xl font-semibold">{copy.team.heading}</h3>
      <ul className="mt-8 grid gap-6 sm:grid-cols-2 md:gap-8 lg:grid-cols-4">
        {copy.team.slots.map((slot) => (
          <li
            key={slot.name + slot.role}
            className="flex h-full min-h-[16rem] flex-col items-center rounded-[16px] bg-brand-white p-8 text-center shadow-[0_12px_32px_-16px_rgba(4,46,94,0.22)] transition-shadow transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_20px_48px_-16px_rgba(4,46,94,0.32)] motion-reduce:transform-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <Portrait
              src={slot.photo}
              alt={`${slot.name}, ${slot.role}`}
              initials={slot.initials}
              className="size-20 text-2xl"
            />
            {slot.placeholder ? (
              <div className="mt-5 flex flex-col items-center gap-3">
                <NeedsInput>{slot.name}</NeedsInput>
                <span aria-hidden className="h-px w-8 bg-brand-navy/30" />
                <NeedsInput>{slot.role}</NeedsInput>
              </div>
            ) : (
              <div className="mt-5 flex flex-col items-center gap-3">
                <p className="font-heading font-semibold">{slot.name}</p>
                <span aria-hidden className="h-px w-8 bg-brand-navy/30" />
                <span className="rounded-full border border-brand-navy/20 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-brand-navy uppercase">
                  {slot.role}
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
