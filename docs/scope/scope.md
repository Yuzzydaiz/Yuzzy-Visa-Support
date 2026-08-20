# Scope: Yuzzy Visa Support

A public marketing site for researchers, engineers, physicians, and executives who want help building EB1A, O1, and NIW profiles. The first slice is one homepage whose job is a booked free consultation.

**Build approach:** Tracer Bullet (a thin end to end thread through the page, booking, and forms first, then thicken sections).
**Workflow:** Alpha (`/check verify` after `/develop`). The project default. A public page that stores names and emails deserves a verify pass, not a Prototype skip.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Landing page | Slice 1 | in-progress |
| 2 | Dedicated section pages | Slice 1 | planned |
| 3 | Staff inbox | Slice 2 | planned |

## Slice 1: Public site

### 1. Landing page · in-progress
One long homepage: understand the services, book a free consultation, or leave a message or email. Honest copy, visible placeholders for missing Yuzzy facts, official logo colors. File layout is section first so each block can later become its own full page without a rewrite.
**Done when:** a visitor can jump the sections, open a live booking link (or fall back to Contact), submit contact and subscribe, and never see fake stats or fake quotes. Each homepage section lives in its own module under `components/sections/`, composed by the home route, not dumped into one page file.
- [x] Design it (spec): `/architect landing page`
- [x] Build it: `/develop landing page`
   - [x] Section first file layout, brand, sticky nav, Book CTA, and form backend schema plus a first contact insert (AC-1, AC-2, AC-3, AC-4, AC-10, AC-11, AC-15)
   - [x] Hero through How we work, using the copy file (AC-1, AC-2, AC-8, AC-12)
   - [x] About, four person team grid, and placeholder style for every `[NEEDS INPUT]` (AC-7, AC-9)
   - [x] Reviews trust strip, FAQ accordion, Contact, Subscribe, Footer (AC-6, AC-8, AC-13)
   - [x] Form hardening, metadata, sitemap, and one stand in hero still (AC-4, AC-5, AC-14)
- [ ] Verify it: `/check verify landing page`
Spec [0001](../specs/0001-landing-page/index.md) · code in `app/(marketing)/`, `components/`, `convex/`

### 2. Dedicated section pages · needs a decision
Promote About, Services, How we work, Reviews, FAQs, and Contact from homepage blocks into their own full routes (`/about`, `/services`, and so on). Reuse the same section modules. Home stays the composition of those modules.
**Done when:** each of those URLs is a full page with shared header and footer, and the homepage still uses the same section files. Nav can switch from hash links to real paths without moving copy.
- [ ] Design it (spec): `/architect dedicated section pages`

## Slice 2: After launch ops

### 3. Staff inbox · needs a decision · from spec 0001
Let Yuzzy read and mark contact messages in the product instead of only in a backend dashboard.
**Done when:** staff can list new messages and mark them read without a public leak of that list.
- [ ] Design it (spec): `/architect staff inbox`

## Deferred

Out of scope for the current build pass, kept so the plan stays honest.
- **Privacy page and unsubscribe**: public unsubscribe and a privacy page if you collect EU emails · from spec 0001 · needs a decision
- **Stronger bot check**: add if the first spam controls are not enough
- **Real headshots and a sourced hero photo**: replace placeholders and the generated still
- **CMS for copy**: only when Yuzzy wants to edit FAQs or services without a deploy

## Legend

**The decision box.** Every feature carries exactly one, the sub task whose label ends with `(spec)`.

**Next step** = the first unticked box (always a command or a tracked milestone). For Landing page that is `/develop landing page` when you are ready.

- **needs a decision** = run `/architect` first.
- **Atomic build tasks live in the spec's `## Build plan`, not here.**
- **Status** `planned` → `in-progress` → `done`.
