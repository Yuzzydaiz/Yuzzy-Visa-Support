# 0001 rationale

## Context

Yuzzy Visa Support helps researchers, engineers, physicians, and executives prepare EB1A, O1, and NIW profiles. The visitor’s job is to book a free call. A contact form and a Stay Informed strip must work without a login. You chose Convex so you own those records. Booking is Calendly in a new tab, not an embed. There is no public pricing, no client portal, no blog, and no visa comparison table in this feature.

Honesty is a load bearing force. Fake testimonials, fake counts, and fake bios would be the fastest way to lose trust. `yuzzy_landing_copy.md` is the content source of truth, including the not a law firm disclaimer and the six services worded as help you prepare, not we secure or we guarantee. Anything marked `[NEEDS INPUT]` must stay visibly unfinished.

Taste is Jinee Green Card as a live visual reference: warm, professional, trust heavy. Structure is your own. The official logo is patriotic. The page must stay a clean consultant layout, not a flag wallpaper. Accent hex values are sampled from that PNG. Do not use Jinee gold.

> Premise note: Convex for two public forms is more moving parts than a form inbox vendor. You chose it so the list is yours. v1 has no staff inbox, so Yuzzy reads messages in the Convex dashboard until a later admin feature exists.
>
> Premise note: Personal data (name, email, message) is stored with no named compliance spec (no GDPR or similar decision on file). Keep the collection small, log no PII in the browser console, and add a privacy page later if you market to the EU.

## Options considered

### Option 1: Static page plus mailto or a form vendor

A Next.js page with copy and CTAs, and contact going to mailto or Formspree. Fastest brochure.

**Pros**:
- Fewest moving parts. No new backend to operate.

**Cons**:
- You do not own a queryable subscriber or message table. The engineer already rejected Formspree.

### Option 2: Next.js App Router, Tailwind 4, shadcn/ui, Convex forms, Calendly new tab

Keep the current Next.js app. Add Convex mutations for contact and subscribe. Book opens Calendly. shadcn/ui for accordion and form controls.

**Pros**:
- Matches the locked stack answers. You own PII in one TypeScript backend.

**Cons**:
- You operate Convex for a brochure site. v1 has no staff inbox.

### Option 3: Next.js plus Resend only

Forms POST to a server action that emails Yuzzy. No stored list.

**Pros**:
- Immediate inbox ping. No database schema.

**Cons**:
- No unique subscriber table. The engineer chose Convex over Resend only.

### Option 4: CMS backed page in v1

Put services, FAQs, team, and copy in a CMS on day one.

**Pros**:
- Yuzzy could edit without a deploy.

**Cons**:
- Extra product for content that is still changing by email.

## Rationale

The conversion job is a booked call, so Calendly as a new tab keeps that path off your origin. Contact and subscribe still need a store you can export later; Convex gives you typed schema and validators. shadcn/ui beats hand rolled Tailwind here because the FAQ accordion, select, and focus rings are accessibility sensitive. Runner up for UI is hand rolled Tailwind.

Spam protection pick: a hidden honeypot field plus `@convex-dev/rate-limiter`. Runner up: Cloudflare Turnstile.

Duplicate subscribe pick: same success as a new subscribe, so a public form must not reveal who is on the list.

JSON-LD pick: `ProfessionalService`, not `LocalBusiness`, because you may have no publishable street address.

Hero still pick: generate one atmosphere image in one pass, mark it as a stand in. Team faces stay placeholders.
