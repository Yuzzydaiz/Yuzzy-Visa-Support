# 0001. Public landing page for Yuzzy Visa Support

**Date**: 2026-08-20
**Status**: In Progress

## Summary

You are shipping one long public homepage whose main job is Book a Free Consultation. Contact and newsletter are secondary, and both persist in Convex (a hosted TypeScript backend). Copy comes from `yuzzy_landing_copy.md`. Brand comes from the official lockup: navy type, red CTAs, white highlights, warm paper ground. You do not invent stats, quotes, or bios. Missing Yuzzy facts stay visible placeholders until he fills them.

## Rationale

See [rationale.md](rationale.md) for Context, Options considered, and the full decision record.

## Requirements

**User stories**:
- As a visitor, I want to understand the services and book a free consultation so that I can talk to Yuzzy without hunting.
- As a visitor, I want to send a contact message or join the email list so that I can reach the team when I am not ready to book.
- As Yuzzy, I want missing facts to look like placeholders so that I can see what to fill, and so visitors never treat a blank as a real stat.
- As Yuzzy, I want the official logo and sampled colors on the page so that the site matches the lockup, not a generic template.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: The site is one homepage with this section order: Hero, trust chips, Services, How we work, About (including team), Reviews, FAQs, Contact, Subscribe, Footer. Header links Home, About, Services, Reviews, FAQs, Contact jump to those in page anchors. (Recommended default: sticky header, hamburger on small screens, Book always visible, no sticky bottom Book bar.)
- **AC-2**: Book a Free Consultation appears in the header and repeats after Hero, after Services, and in the Footer. When `NEXT_PUBLIC_CALENDLY_URL` is set, each live Book control opens that URL in a new tab with `rel="noopener noreferrer"`.
- **AC-3**: When `NEXT_PUBLIC_CALENDLY_URL` is missing or empty, Book controls do not open a blank tab. They look disabled or they scroll to `#contact`.
- **AC-4**: The contact form has Name, Email, Visa Category dropdown (`EB1A` / `O1` / `EB2 NIW`), and Message. A valid submit inserts a `contactMessages` row in Convex and shows success. Field errors show on invalid input. Network failure shows an error, never a fake success.
- **AC-5**: The Stay Informed strip stores unique emails in Convex `subscribers`, with the legal disclaimer from the copy. A duplicate email returns the same success as a first subscribe (no email enumeration). Invalid email shows a validation error.
- **AC-6**: The page never presents fake testimonials, fake names, fake companies, fake stars, or fake statistics as real. Reviews v1 is a Trusted by professionals line plus anonymized case type chips only. No quote cards until real quotes exist.
- **AC-7**: Every `[NEEDS INPUT]` surface from the copy is visible in placeholder style (hero credential line, founder bio, timeline FAQ answer, publishable email, publishable phone, the three non Yuzzy team names and roles). Placeholder style cannot be read as a real metric. Recommended default: dashed border, muted italic text that still includes the `[NEEDS INPUT]` marker, cream warning chip background, `aria-label` that says it is awaiting Yuzzy. Never a large numeral styled as a stat.
- **AC-8**: The Footer includes the disclaimer from `yuzzy_landing_copy.md` (informational services only, not attorneys, no legal advice, no outcome guarantee). The FAQ “Do you provide legal advice?” answers No, from the copy. Six services use the copy titles and honest prepare wording: Research Publication Support, Citation Growth Strategy, Peer Review Opportunities, Professional Membership Guidance, Media Coverage Support, USCIS Ready Documentation. Simple line icons for those six. Do not display IEEE or ACM logos as endorsement.
- **AC-9**: About includes a team grid of four slots including Yuzzy as founder, with named people and roles. Portraits are placeholders (initials on a navy circle, or empty frames). Do not generate fake faces and present them as the real team.
- **AC-10**: Header is sticky. Below the `md` breakpoint, nav links sit in a hamburger. The Book button stays visible. No sticky bottom Book bar on small screens. (Recommended default.)
- **AC-11**: The official lockup is served from `public/brand/yuzzy-logo.png` (copy at build from the engineer’s logo PNG). CSS tokens are `--brand-navy: #042E5E`, `--brand-red: #AA0B0F`, `--brand-white: #FFFFFF` (sampled from that PNG: median of saturated navy pixels, median of saturated red pixels, white field). Desktop header may use the full stacked lockup if it fits; small screens use the emblem plus the word Yuzzy. Page ground is a warm off white (recommended default `#F6F3EE`, not sampled from the logo). Header type and icons use navy. Primary CTAs use red. No Jinee gold. No flag wallpaper. If the PNG is missing, the site still builds with a text wordmark “Yuzzy Visa Support”.
- **AC-12**: Out of this feature: public pricing, client portal, blog, Jinee style visa comparison table, Convex auth on the public site, staff inbox UI, and live `/about` (or similar) routes. Those dedicated pages are a later scope feature. This feature still ships one homepage.
- **AC-15**: File layout is section first. Shared chrome lives in `app/(marketing)/layout.tsx`. Home (`app/(marketing)/page.tsx`) only composes section modules. Each homepage block is its own file under `components/sections/`. Nav items live in one `lib/navigation.ts` list with both the v1 hash (`/#about`) and the future path (`/about`). Do not create the dedicated route folders in this feature. Do not dump section markup into `app/page.tsx`.
- **AC-13**: FAQ is an accordion with one question open at a time (recommended default). Keyboard users can open and close it. Interactive controls show a visible focus ring (recommended default: `2px` navy outline, `2px` offset). `prefers-reduced-motion: reduce` turns off accordion height animation and decorative motion (recommended default).
- **AC-14**: The document title and description come from the copy (title: Yuzzy Visa Support, description from the hero subheadline). Open Graph, canonical, `sitemap.xml`, `robots.txt`, and JSON-LD `ProfessionalService` publish using `NEXT_PUBLIC_SITE_URL`. No `aggregateRating`. The marketing page is static (SSR or SSG). Forms are client islands.

## Decision

**Chosen option**: Option 2: Next.js App Router, Tailwind 4, shadcn/ui, Convex forms, Calendly new tab

You keep Next.js App Router and Tailwind 4. You add Convex for `contactMessages` and `subscribers`. You open Calendly in a new tab. You use shadcn/ui for accordion, select, input, textarea, button, and label. Brand tokens come from the sampled logo. Marketing copy stays static in code, sourced from `yuzzy_landing_copy.md`. The app uses a section first file layout (route group plus one module per homepage block) so a later feature can promote each block to its own full page without a rewrite.

**Implementation skills**: `convex` (`get-convex/agent-skills`, `.agents/skills/convex/`) · `convex-design` (`get-convex/agent-skills`, `.agents/skills/convex-design/`) · `convex-add` (`get-convex/agent-skills`, `.agents/skills/convex-add/`)

## Feature design

**Data model sketch**:

Two Convex tables. No foreign keys. Team, FAQs, services, and all marketing copy stay static in code (or a local MD import), not Convex, until a CMS exists (out of scope). Calendly URL is env, not a row.

```
contactMessages                          subscribers
----------------                         ----------------
_id (Convex Id)                          _id (Convex Id)
name            string  required         email           string  required, unique via by_email
email           string  required         source          string  required ("newsletter_strip")
visaCategory    union   required         createdAt       number  required (Date.now on insert)
  "EB1A" | "O1" | "EB2_NIW"              unsubscribedAt  number  optional (unset means active)
message         string  required
status          union   required
  "new" | "read"
sourcePage      string  optional
userAgent       string  optional
createdAt       number  required
honeypot is NOT stored

Indexes:
contactMessages.by_createdAt          ["createdAt"]
contactMessages.by_status_and_created ["status", "createdAt"]  (admin later, define now)
subscribers.by_email                  ["email"]
```

`_creationTime` exists on every Convex document. Still store `createdAt` so exports and admin sorts do not depend on an internal field.

**State transitions**:
- `contactMessages.status`: insert as `new`. `read` is for a later admin UI. v1 never flips it in the public app.
- `subscribers`: active when `unsubscribedAt` is unset. Unsubscribed when `unsubscribedAt` is set. No public unsubscribe UI in v1.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `api.contact.submit` | Convex `mutation` | `name: string` (req), `email: string` (req), `visaCategory: "EB1A" \| "O1" \| "EB2_NIW"` (req), `message: string` (req), `website: string` (opt honeypot), `sourcePage: string` (opt) | `{ ok: true }` | public | `422` style `ConvexError` for invalid fields; honeypot filled returns `{ ok: true }` with no insert |
| `api.subscribers.subscribe` | Convex `mutation` | `email: string` (req), `website: string` (opt honeypot) | `{ ok: true }` | public | invalid email `ConvexError`; duplicate email `{ ok: true }` no second row |
| `internal.contact.list` | Convex `internalQuery` | `paginationOpts` | page of messages | internal only | none in v1 UI |
| `internal.subscribers.list` | Convex `internalQuery` | `paginationOpts` | page of emails | internal only | none in v1 UI |

No public query may list messages or emails. Internal list exists so you are not boxed later; do not wire it to the marketing page.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Header logo | Lockup image | File `public/brand/yuzzy-logo.png` copied from the engineer logo PNG; fallback text “Yuzzy Visa Support” |
| Brand colors | Navy, red, white | Sampled from that PNG: `--brand-navy` `#042E5E`, `--brand-red` `#AA0B0F`, `--brand-white` `#FFFFFF` |
| Page ground | Warm paper | Recommended default `#F6F3EE` (not sampled) |
| Nav labels | Home, About, Services, Reviews, FAQs, Contact, Book | `lib/navigation.ts`, strings from `yuzzy_landing_copy.md` nav |
| Nav targets (v1) | In page hashes | `lib/navigation.ts` `hash` field (`/#about` and the rest). Future `href` (`/about`) is stored beside it, unused until Dedicated section pages |
| Hero eyebrow, headline, subheadline, primary CTA | Those strings | `yuzzy_landing_copy.md` hero |
| Hero credential line | `[NEEDS INPUT]` placeholder | copy file placeholder, placeholder style |
| Hero / atmosphere image | One generated still | Cursor GenerateImage once, alt marks it as a stand in |
| Trust chips | EB1A, O1, NIW, researchers, engineers, physicians, executives | Recommended default (engineer skipped UI questionnaire) |
| Six service titles, bodies, icons | Card copy and line icons | copy file services section; icons as specified there |
| Services CTA | Book a Free Assessment | copy file; same Calendly behavior as Book |
| How we work | Assess, Build, File ready plus short helper lines | Locked three steps. Recommended helper lines: Assess (review background, target category, current evidence); Build (publications, citations, memberships, visibility you can stand behind); File ready (help assemble USCIS aligned documents for an attorney). Do not invent outcome claims. |
| About body | About paragraphs | copy file About |
| Founder bio | `[NEEDS INPUT]` placeholder | copy file |
| Team slot 1 | Yuzzy, founder | copy file plus locked “four people including Yuzzy” |
| Team slots 2 to 4 | Name and role placeholders | `[NEEDS INPUT]` placeholder style; initials portraits |
| Reviews heading and chips | Trusted by professionals; anonymized case types | Locked reviews v1; case types as chips such as Software Engineer, EB1A (role plus category only, no names) |
| FAQ questions and answers | Six FAQs | copy file FAQs |
| Timeline FAQ answer | `[NEEDS INPUT]` placeholder | copy file |
| Contact intro | Get in Touch body | copy file |
| Contact details column | Email, phone | `[NEEDS INPUT]` placeholders until Yuzzy confirms. Do not treat `09072837051` as confirmed public. No map. No address unless a later input lands. |
| Contact form success / error | Status text | Derived from Convex mutation result or client network error |
| Subscribe heading, body, disclaimer | Stay Informed copy | copy file subscribe section |
| Subscribe success | Status text | Convex result; duplicate treated as success |
| Book href | Calendly URL or `#contact` | `NEXT_PUBLIC_CALENDLY_URL` or fallback in **AC-3** |
| Footer disclaimer, tagline, copyright | Footer strings | copy file footer; year derived from `new Date()` on the server |
| Meta title | Yuzzy Visa Support | copy hero headline brand name |
| Meta description | Hero subheadline | copy file |
| Canonical, OG url | Absolute origin | `NEXT_PUBLIC_SITE_URL` |
| OG image | Branded still | Generated hero still or logo on white; not a fake team photo |
| JSON-LD | `ProfessionalService` name, description, url, serviceType | name and description from copy; url from `NEXT_PUBLIC_SITE_URL`; serviceType EB1A / O1 / NIW profile building; omit address and aggregateRating |
| `contactMessages.*` fields | Inserted row | Form inputs plus `status: "new"`, `createdAt: Date.now()`, optional `sourcePage` from `window.location.pathname`, optional `userAgent` from `navigator.userAgent` (store if you send it, never `console.log` it) |
| `subscribers.email` | Inserted or skipped duplicate | Form input, normalized trim plus lowercase |
| `subscribers.source` | `"newsletter_strip"` | Constant in the mutation caller |
| Rate limit decision | Allow or reject | `@convex-dev/rate-limiter` on a coarse key (hashed email) |

**Key invariants**:
- Public mutations validate with Convex `v` validators (`v.literal` for visa category and status). Invalid data never writes.
- `subscribers.email` is unique. Duplicate subscribe is a no op success.
- Honeypot `website` nonempty: return success, write nothing.
- No public read of either table.
- Marketing claims cannot exceed `yuzzy_landing_copy.md`. No stronger we get you X language.
- Placeholder nodes always include the `[NEEDS INPUT]` marker.
- Rate limiter wraps both public mutations.

**Security model**:
- The homepage is public read. Anyone can call `submit` and `subscribe`.
- There is no Convex auth on this site in v1. Do not add a public `list` query “for convenience”.
- PII is name, email, message, optional userAgent. Do not print PII with `console.log`. Do not put PII in analytics event properties.
- Staff read path in v1 is the Convex dashboard. Internal queries are not exposed to the browser.
- Legal: footer disclaimer plus the legal advice FAQ. Not a law firm. No petition or membership guarantees.
- Do not show IEEE, ACM, Springer, or Elsevier logos in a way that looks like endorsement. Text mentions in the copy are fine.
- Recommended default spam control: honeypot plus rate limiter. Runner up Turnstile (see Follow-up).

**File layout** (v1 ships one homepage; folders are ready for later full pages):

```
app/
  layout.tsx                 # html, fonts, global metadata
  globals.css
  sitemap.ts
  robots.ts
  (marketing)/
    layout.tsx               # SiteHeader + SiteFooter only
    page.tsx                 # Home: compose section modules, no section markup inline
components/
  layout/
    site-header.tsx
    site-footer.tsx
    mobile-nav.tsx
  sections/
    hero.tsx
    trust-chips.tsx
    services.tsx
    how-we-work.tsx
    about.tsx
    team.tsx
    reviews.tsx
    faqs.tsx
    contact.tsx
    subscribe.tsx
  ui/                        # shadcn primitives
lib/
  navigation.ts              # { id, label, hash, href } per item; v1 links use hash
  copy.ts                    # typed strings from yuzzy_landing_copy.md
  site.ts                    # Calendly helper, site URL helper
convex/
  schema.ts
  contact.ts
  subscribers.ts
public/
  brand/
    yuzzy-logo.png
```

Later, Dedicated section pages adds `app/(marketing)/about/page.tsx` (and the rest) that import the same section modules. Header and footer do not move. Nav switches `hash` to `href`. Do not put Convex functions, copy, or UI primitives inside a section file that would make that promotion messy.

**Configuration required**:
- `NEXT_PUBLIC_CALENDLY_URL`: public Calendly scheduling link. Empty means **AC-3** fallback.
- `NEXT_PUBLIC_SITE_URL`: canonical origin for metadata, OG, sitemap, JSON-LD (example `https://www.example.com`, no trailing slash).
- `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOYMENT`: set by Convex install, required for forms.
- Logo file at build: copy the official PNG to `public/brand/yuzzy-logo.png`.

**Critical test scenarios** (each maps to an acceptance criterion in ## Requirements):
- Happy path: visitor lands, jumps via nav, books with a set Calendly URL in a new tab, submits contact, subscribes once, verifies **AC-1**, **AC-2**, **AC-4**, **AC-5**
- Failure case: empty Calendly env does not open a blank tab; contact network error shows error; duplicate subscribe still shows success; honeypot filled writes nothing, verifies **AC-3**, **AC-4**, **AC-5**
- Honesty case: reviews region has no quote cards or stars; `[NEEDS INPUT]` nodes use placeholder style; timeline FAQ is a placeholder, verifies **AC-6**, **AC-7**, **AC-8**
- Brand case: sampled tokens present; logo or text wordmark renders; no gold accent; team has four slots with placeholder portraits, verifies **AC-9**, **AC-11**
- Structure case: `app/(marketing)/page.tsx` imports section modules; `components/sections/` has one file per block; no dedicated `/about` route yet; `lib/navigation.ts` has both hash and future href, verifies **AC-15**, **AC-12**
- Auth/permission: from the browser, a crafted public query cannot list `contactMessages` or `subscribers` (those functions are internal or absent from the public `api`), verifies **AC-12**
- Access case: keyboard opens one FAQ at a time; focus ring visible; reduced motion cuts accordion animation, verifies **AC-13**
- SEO case: view source on `/` has title, description, canonical, JSON-LD `ProfessionalService` without aggregateRating; `/sitemap.xml` and `/robots.txt` exist, verifies **AC-14**

## Build plan

Tracer Bullet (assumed, because `AGENTS.md` records no project default): wire one thin thread through UI, env, and Convex, then thicken in page order.

1. [x] Stand up the section first tree (`app/(marketing)/`, `components/layout/`, `components/sections/`, `lib/navigation.ts`). Copy the official logo to `public/brand/yuzzy-logo.png`. Set `--brand-navy`, `--brand-red`, `--brand-white` (and the recommended page ground). Replace the create-next-app shell with a sticky header, in page anchors, and one Book CTA that reads `NEXT_PUBLIC_CALENDLY_URL` with the **AC-3** fallback. Install Convex. Create the target schema (both tables and indexes) in one `schema.ts`. Ship `submit` so a minimal contact call can insert a valid row, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-10**, **AC-11**, **AC-15**
2. [x] Thicken sections in locked order using `yuzzy_landing_copy.md`: Hero, trust chips (recommended default set), Services (six cards, line icons, honest wording), How we work (three steps). Repeat Book after Hero and after Services, satisfies **AC-1**, **AC-2**, **AC-8**, **AC-12**
3. [x] About with body copy, founder placeholder, team grid of four slots, placeholder portraits (no generated faces). Wire placeholder visual system for all `[NEEDS INPUT]` nodes, satisfies **AC-7**, **AC-9**
4. [x] Reviews trust strip and anonymized case types (no quote cards). FAQ accordion (shadcn/ui, one open, keyboard, reduced motion). Contact two column (form plus details placeholders). Stay Informed strip. Footer disclaimer, repeated nav, Book. Focus rings, satisfies **AC-6**, **AC-8**, **AC-13**, **AC-10**
5. [x] Finish `submit` and `subscribe` with validators, honeypot, rate limiter, duplicate subscribe success, client success and error states. Do not `console.log` PII, satisfies **AC-4**, **AC-5**
6. [x] Metadata, Open Graph, canonical, JSON-LD `ProfessionalService`, `sitemap.xml`, `robots.txt`. Generate one hero or atmosphere still with Cursor GenerateImage, mark it as a stand in, satisfies **AC-14**, **AC-11**

## Consequences

**Positive**:
- One conversion path (Calendly) and two owned form tables without a CMS.
- Honest copy and visible placeholders reduce legal and trust risk.
- Sampled logo colors make the page match the lockup instead of waiting or guessing gold.

**Negative / tradeoffs**:
- Convex is another deploy and dashboard for a brochure. Yuzzy cannot triage messages in product until an admin feature exists.
- Honeypot plus rate limiter will miss some bots. Turnstile is stronger and is deferred.
- Duplicate subscribe as success can confuse a person who expected “already on the list”.
- A generated hero still can look generic next to real headshots later; you will replace it.
- shadcn/ui is a new UI kit in a repo that did not have it.

**Neutral**:
- Accent tokens are now locked to sampled hex. If the logo file is redrawn, resample.
- Static copy means a deploy to change FAQs or services.
- `read` status and `unsubscribedAt` exist before any UI uses them.
- Convex skill conventions are not in this repo’s `AGENTS.md` yet (Follow-up).

## Follow-up

- [ ] `convex` conventions are not in root `AGENTS.md`. They belong in a nested `convex/AGENTS.md` (schema, validators, public vs internal, no PII in client logs), with a one line pointer from root, because they apply when working under `convex/`, not on every file
- [ ] Confirm with Yuzzy before launch: publishable email, publishable phone, founder bio, timeline range, names and roles for the other three teammates, permissioned real quotes if any
- [ ] Staff inbox to list `contactMessages` (separate feature, from spec 0001)
- [ ] Public unsubscribe and a privacy page if you collect EU emails (separate feature)
- [ ] Add Cloudflare Turnstile if honeypot plus rate limiter is not enough
- [ ] Real headshots replace placeholder portraits; optional later swap of the generated hero still for a sourced photo
- [ ] CMS only when Yuzzy wants to edit copy without a deploy
- [ ] Consider `npx convex ai-files install` when Convex is added, so generated Convex guidance stays current
- [ ] Dedicated section pages (`/about`, `/services`, and so on) are enrolled on the scope as feature 2. They reuse `components/sections/` and `lib/navigation.ts`. Do not build those routes in this spec.
