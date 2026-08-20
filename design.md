---
name: yuzzy-consultant-design-system
source: derived
character: "Warm paper, navy Inter headings, Geist body, and a single red accent from the official lockup. Product-site consulting, not a flag poster and not a template. Hero uses a soft navy/red atmosphere, a treated photo, and honest stat cells instead of fake proof."
tokens: "real values live in app/globals.css; read them there, never duplicated here"
contrast: "ink on canvas about 12:1; body on canvas about 9:1; white on accent about 8:1; muted on canvas about 5.5:1. Light marketing surface only."
---

## Build mandate

You are a senior product designer. Every page ships as a complete, professional product surface: brand, real product copy, a considered layout with hierarchy, all states (empty, loading, error), supporting content, and a footer. Maximalist in craft, never a lone form on an empty page.

## Character & direction

Yuzzy Visa Support is a small practice helping people prepare EB1A, O1, and NIW profiles. The lockup is patriotic. The page is not. Cream paper, Inter headings, navy type, red only on primary actions. The hero is a two-column product layout (pill eyebrow, tight type rhythm, treated image with a floating honesty card, faint grid plus color blobs). Jinee Green Card is the taste reference (trust, warmth, scanability), not a layout to clone.

## Composition patterns

Shared chrome in `app/(marketing)/layout.tsx`. Home composes section modules in locked order. Each homepage block is a full bleed band with an inner max width. Nav is sticky. Book is always visible. No bottom mobile bar. The footer is a 10% navy-tinted four-column hub (logo + LinkedIn slot, quick links, Mail/Phone contact, compact Book CTA). Disclaimer is xs muted fine print under a hairline; copyright is the smallest line.

## Component & usage rules (do's and don'ts)

- Red is for primary CTAs and thin 3px card rails only, never for decorative washes or fake stats. Soft red/navy blobs behind the hero are atmosphere, not a wash over copy.
- Service, how-we-work, founder bio, and team cards use 16px radius, white fill, and a soft navy shadow. Service, how-we-work, and team cards also get a slight hover lift. Service cards also get a 3px navy/red top rail; the first may use a 6% navy tint and a “Start here” pill — not a popularity claim. How-we-work uses large navy numbered badges on a dashed connecting path (horizontal on `md+`, vertical on small screens), not red labels. About intro is `70ch` / `leading-[1.8]`. Founder is a two-column bio card (avatar + text). Team portraits are real photos when `photo` is set, navy initials otherwise — never generated faces. FAQ cards stay hairline. The hero photo may use a soft navy shadow, 18px radius, and a bottom gradient overlay.
- The hero Book button may use rounded-xl, a light shadow, and a stronger hover. Other buttons stay compact.
- Placeholders keep the `[NEEDS INPUT]` marker, a dashed border, and a muted italic voice. Never a large numeral styled as a stat. The hero may show a real `3` for visa categories (EB1A, O1, NIW); missing counts stay placeholder chips in the stat row. Footer email, phone, and LinkedIn stay `NeedsInput` until real values are set — never invented `mailto`, `tel`, or social URLs. No address until copy provides one.
- Do not show IEEE, ACM, Springer, or Elsevier logos.
- Do not invent testimonials, stars, or approval rates.

## Responsive & accessibility direction

Below `md`, nav links sit in a sheet. Book stays in the header. Focus ring is a 2px navy outline with 2px offset. `prefers-reduced-motion: reduce` turns off accordion height animation and decorative motion. Forms announce success and error through a live region.
