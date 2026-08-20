# Verify: landing page · spec 0001 · updated 2026-08-20

_Steps derived from spec 0001 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Visit `/` and confirm section order: Hero, trust chips, Services, How we work, About (team), Reviews, FAQs, Contact, Subscribe, Footer. Header jumps to in page anchors. → AC-1
- [ ] Book a Free Consultation appears in the header, after Hero, after Services, and in the Footer. With `NEXT_PUBLIC_CALENDLY_URL` set, each live Book control opens that URL in a new tab. → AC-2
- [ ] With `NEXT_PUBLIC_CALENDLY_URL` empty, Book controls jump to `#contact` and do not open a blank tab. → AC-3
- [ ] Submit a valid contact form (Name, Email, visa category, Message) and see success. Confirm a `contactMessages` row in the Convex dashboard. Invalid fields show errors. Pull the network to fail and see an error, never a fake success. → AC-4
- [ ] Subscribe with a new email and see success. Subscribe the same email again and still see success. Invalid email shows a validation error. Disclaimer is visible. → AC-5
- [ ] Reviews has a Trusted by professionals line and anonymized case types only. No quote cards, names, companies, or stars. → AC-6
- [ ] `[NEEDS INPUT]` appears on the hero credential line, founder bio, timeline FAQ, contact email, contact phone, and three teammate slots, in placeholder style. → AC-7
- [ ] Footer disclaimer is present. FAQ “Do you provide legal advice?” answers No. Six services use the copy titles. No IEEE or ACM logos. → AC-8
- [ ] Team grid has four slots. Yuzzy is founder. Other portraits are initials, not generated faces. → AC-9
- [ ] Header stays sticky. Below `md`, nav is in a menu. Book stays visible. No bottom Book bar. → AC-10
- [ ] Logo renders from `/brand/yuzzy-logo.png`. CTAs are red. Type is navy. Page ground is warm paper. No gold. → AC-11
- [ ] There is no `/about` (or similar) route yet. No pricing, portal, or blog. → AC-12, AC-15
- [ ] FAQ accordion opens one item at a time from the keyboard. Focus ring is visible. Reduced motion cuts accordion animation. → AC-13
- [ ] View source on `/` has title Yuzzy Visa Support, the hero description, canonical, JSON-LD `ProfessionalService` without `aggregateRating`. `/sitemap.xml` and `/robots.txt` exist. → AC-14

## Commands

- [ ] `pnpm exec tsc --noEmit` → clean → AC-15
- [ ] `pnpm build` → `/` is static, `/sitemap.xml` and `/robots.txt` exist → AC-14
- [ ] After `npx convex dev`, submit contact and subscribe once each, then confirm rows in the dashboard → AC-4, AC-5
- [ ] From the browser console, `api.contact.list` and `api.subscribers.list` are not public functions → AC-12

## Value sourcing

- [ ] Header logo comes from `public/brand/yuzzy-logo.png` → header logo
- [ ] Brand colors match `--brand-navy #042E5E` and `--brand-red #AA0B0F` → brand colors
- [ ] Nav uses `lib/navigation.ts` hash fields (`/#about`), and `href` (`/about`) is present but unused → nav targets
- [ ] Hero copy matches `lib/copy.ts` / `yuzzy_landing_copy.md` → hero strings
- [ ] Hero image alt marks it as a stand in → hero still
- [ ] Book href is `NEXT_PUBLIC_CALENDLY_URL` or `#contact` → Book href
- [ ] Contact success or error text comes from the Convex mutation result or a client network error, never a hardcoded fake success on failure → contact form status
- [ ] Subscribe duplicate is treated as success → subscribe success
- [ ] JSON-LD `url` comes from `NEXT_PUBLIC_SITE_URL` → JSON-LD
- [ ] Footer year comes from `new Date()` on the server → footer copyright

## Acceptance-criteria coverage

- AC-1 covered by homepage order step
- AC-2 covered by Book with Calendly step
- AC-3 covered by empty Calendly step
- AC-4 covered by contact form and Convex dashboard steps
- AC-5 covered by subscribe steps
- AC-6 covered by Reviews honesty step
- AC-7 covered by placeholder step
- AC-8 covered by disclaimer and services step
- AC-9 covered by team grid step
- AC-10 covered by sticky header step
- AC-11 covered by brand step
- AC-12 covered by no extra routes and no public list step
- AC-13 covered by accordion keyboard step
- AC-14 covered by SEO and build steps
- AC-15 covered by structure and typecheck steps
