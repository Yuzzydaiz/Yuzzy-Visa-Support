# Yuzzy AI Research Writer — Step-by-Step Build Chunks

**Authority:** This file is an execution breakdown of
`/home/zayntechinfo/Yuzzy_AI_Research_Writer_Implementation_Plan.docx`
(Yuzzy AI Research Writer Implementation Plan, prepared 14 September 2026).

If this file and the plan disagree, **the plan wins**. Record the mismatch in
the chunk’s Deviation log and stop if it is a product, pricing, payment, or
scope change.

**Product:** Paid AI-assisted research paper drafting workspace at `/research`
inside this Next.js site. Not a research platform. Not original completed
research. Not a second app with a new theme.

**Hard product rule:** Users pay with Bachs **before** any outline or section
is generated. A checkout redirect is not payment. Only a verified signed
webhook that matches amount and currency may move an order to `paid` and a
paper to `ready`. `POST .../generate-next` and `POST .../regenerate` must
reject unpaid papers.

---

## How to use this document

1. Complete chunks in order. Do not start chunk N+1 until N’s **Exit condition**
   is true.
2. Each chunk is one buildable unit: files, behavior, tests, and a stop line.
3. End every chunk with: changed files, commands run, test results, remaining
   risks, owner setup still needed.
4. Keep Crossref, OpenAlex, OpenAI, and Bachs behind typed adapters so they can
   be mocked.
5. Centralize pricing, models, limits, citation styles, and flags in validated
   server config (`lib/config/research.ts`). Do not scatter them in routes.
6. Never weaken payment, access-token, webhook-signature, or citation validation
   to make a test pass.
7. Use sandbox or mocks in development. Do not trigger live Bachs charges or
   unbounded OpenAI spend in tests.
8. Do not implement deferred features (plan §18) unless the owner explicitly
   expands scope.

Plan section map:

| Chunks | Plan sections |
| --- | --- |
| C00 | §5, §19 |
| C01–C04 | §6, §12, Appendix B |
| C05–C08 | §3, §1.2 |
| C09–C13 | §7 |
| C14–C16 | §9, §10 |
| C17–C22 | §8, §10, §13 |
| C23–C25 | §11 |
| C26–C27 | §11.5–11.6 |
| C28–C30 | §12–§17, §16 |

---

## Repo snapshot (must adapt to, not ignore)

Inspected 14 September 2026. Re-inspect at the start of C00; this snapshot can
go stale.

| Fact | Current repo |
| --- | --- |
| Router | App Router (`app/`) |
| Home | `app/(marketing)/page.tsx` |
| Layout | `app/(marketing)/layout.tsx` plus root `app/layout.tsx` |
| UI | Tailwind v4, existing `components/ui/*` (Button, Input, Textarea, Select, Field, Sheet, Accordion, Badge, Label) |
| Primary CTA | `BookCta` in hero and header (Calendly / contact). **Keep it.** Research is a **secondary** hero button. |
| Backend already in use | Convex for contact messages and subscribers (`convex/schema.ts`) |
| Plan database for this product | MongoDB Atlas + Mongoose |
| Tests | No `test` script in `package.json` yet |
| Package manager | pnpm |
| Next | 16.3.1, React 19, TypeScript |

**Database decision (plan-faithful):** Research orders, papers, references,
generation state, and audit data live in **MongoDB** as specified in plan §4.1
and §6. **Do not replace Convex.** Keep Convex for existing marketing forms.
Do not introduce a second Express server. Do not import MongoDB or secret
modules into client components.

If the owner later chooses Convex for research data instead of MongoDB, that is
a scope change: stop and ask. Do not silently switch.

---

## Global engineering rules (every chunk)

From plan §1, §5.2, §12, §19:

- Preserve existing header, footer, colours, type, spacing, and primary
  conversion flow.
- Prefer existing UI primitives. Add a dependency only when nothing suitable
  exists.
- Cached MongoDB connection helper; no new connection on every hot reload.
- Secrets only in server env. No `NEXT_PUBLIC_` for API keys, webhook secrets,
  or recovery pepper.
- Public IDs are not authorization. Access is the recovery token (and later an
  HttpOnly cookie after exchange).
- Money is integer cents. Browser-submitted prices are ignored.
- Citation formatting is CSL, not the language model.
- Source existence is Crossref/OpenAlex, not the language model.
- Model output uses `[CITE:ref_01]` tokens only.
- Original research must never invent participants, procedures, measurements,
  statistics, or outcomes.
- Metadata-only sources must not be described as full-text access and must not
  support detailed empirical claims.
- Unverified references must not enter the allowed citation list.

---

## Chunk index

| ID | Name | Depends on |
| --- | --- | --- |
| C00 | Discovery, baseline, and folder contract | — |
| C01 | Research server configuration and `.env.example` | C00 |
| C02 | MongoDB connection and Mongoose models | C01 |
| C03 | State-transition services | C02 |
| C04 | Shared Zod validation and API error codes | C01 |
| C05 | Marketing integration (hero + landing section) | C00 |
| C06 | `/research` shell, steps, and paper-details form | C04, C05 |
| C07 | Reference input list (client, unpaid) | C06 |
| C08 | Review step, local draft persistence, price preview | C01, C07 |
| C09 | Safe-fetch and SSRF guards | C01 |
| C10 | Crossref adapter | C09 |
| C11 | OpenAlex adapter | C09 |
| C12 | Reference resolve pipeline and scoring | C10, C11, C04 |
| C13 | `POST /api/research/references/resolve` + match UI | C07, C12 |
| C14 | Additional source discovery (optional flag) | C13 |
| C15 | Access tokens, orders, and Bachs checkout create | C02, C03, C08, C13 |
| C16 | Bachs webhook, success/cancel pages, status poll | C15 |
| C17 | Citation token parser and CSL renderer | C04 |
| C18 | OpenAI client, model config, prompt builders | C01, C17 |
| C19 | Source manifest, outline generation, outline validation | C14, C16, C18 |
| C20 | `generate-next` lock, one step, persistence | C19 |
| C21 | Section validation, repair attempt, coherence pass | C20 |
| C22 | Generation progress UI and recovery resume | C20, C16 |
| C23 | TipTap editor, citation nodes, sources panel | C17, C22 |
| C24 | Autosave (`PATCH`) with `editorVersion` | C23 |
| C25 | Section regeneration quota | C21, C24 |
| C26 | Normalized export model and DOCX | C23 |
| C27 | PDF export from the same model | C26 |
| C28 | Rate limits, privacy copy, logging, retention hooks | C16, C25, C27 |
| C29 | Full test suite (unit, integration, e2e, adversarial) | C28 |
| C30 | Production cutover checklist | C29 |

Do not skip to C30. Phase 9 of the plan is a controlled live payment after
preview hardening.

---

## C00 — Discovery, baseline, and folder contract

**Plan:** §5.1, §5.2, §19.1, Appendix A

**Goal:** Know the repo as it is. Record baseline failures. Agree file
placement. Do not ship product behavior yet.

### Steps

1. Read `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `eslint.config.mjs`,
   `next.config.ts`, `app/layout.tsx`, `app/(marketing)/layout.tsx`,
   `components/layout/site-header.tsx`, `components/sections/hero.tsx`,
   `lib/copy.ts`, `lib/navigation.ts`, `convex/schema.ts`.
2. Run existing checks and save output:
   - `pnpm lint`
   - `pnpm build`
3. Confirm App Router (already true). All new pages go under `app/`.
4. Confirm no MongoDB, Bachs, OpenAI, Zod, TipTap, or `docx` packages yet.
5. Create the folder contract **adapted to this repo** (do not invent a
   parallel `src/` tree):

```text
app/research/
  page.tsx
  payment/success/page.tsx
  payment/cancelled/page.tsx
  paper/[paperId]/page.tsx
app/api/research/
  references/resolve/route.ts
  orders/route.ts
  payments/webhook/route.ts
  papers/[paperId]/route.ts
  papers/[paperId]/generate-next/route.ts
  papers/[paperId]/regenerate/route.ts
  papers/[paperId]/export/route.ts
components/research/
lib/config/research.ts
lib/db/mongodb.ts
lib/models/Order.ts
lib/models/Paper.ts
lib/research/references/
lib/research/ai/
lib/research/citations/
lib/research/payments/
lib/research/security/
lib/research/export/
lib/validation/research.ts
tests/unit/
tests/integration/
tests/e2e/
```

6. Add a test runner only if this chunk needs a place for later tests
   (Vitest recommended). Do not write feature tests yet.
7. Write `docs/research-writer/baseline.md` with lint/build results and any
   pre-existing failures (plan: record baseline separately from new failures).

### Do not

- Change hero, header, or Convex schema in this chunk.
- Add production secrets.
- Create an Express server.

### Exit condition

Baseline commands documented. Folder contract written. Existing site still
builds as before. Ready for config-only work.

---

## C01 — Research server configuration and `.env.example`

**Plan:** §4.1, §8.1, §9.1, §12.1, §12.4, Appendix B

**Goal:** One validated config module. Names committed, values never committed.

### Files

- `lib/config/research.ts`
- `.env.example` (append research vars; do not put values)
- Optional: `lib/config/research.test.ts` later in C29; a small unit test for
  defaults may live here.

### Required variables (names only)

| Variable | Purpose | Default if allowed |
| --- | --- | --- |
| `MONGODB_URI` | Mongo connection | none (required at runtime for research APIs) |
| `OPENAI_API_KEY` | Server key | none |
| `OPENAI_WRITING_MODEL` | Drafting model | pin in config, e.g. GPT-5.6 Terra id from current OpenAI docs |
| `OPENAI_UTILITY_MODEL` | Lightweight model | GPT-5.6 Luna id from current docs |
| `BACHS_API_KEY` | Bachs secret | none |
| `BACHS_WEBHOOK_SECRET` | HMAC secret | none |
| `BACHS_API_BASE_URL` | Sandbox or live | sandbox URL from current Bachs docs |
| `BACHS_PRODUCT_ID` | Optional fixed product | optional |
| `APP_BASE_URL` | Callbacks and recovery links | none in prod |
| `RECOVERY_TOKEN_PEPPER` | Token hashing | none |
| `CROSSREF_CONTACT_EMAIL` | Polite User-Agent / mailto | none |
| `OPENALEX_API_KEY` | Optional | optional |
| `EMAIL_API_KEY` | Optional recovery email | optional |
| `EMAIL_FROM` | Optional sender | optional |
| `WORDS_PER_PAGE` | Billable words per page | `300` |
| `PRICE_PER_PAGE_CENTS` | Unit price | `25` |
| `MINIMUM_ORDER_CENTS` | Floor charge | `250` |
| `MIN_PAGES` | Clean $0.25 presentation | `10` |
| `MAX_PAGES` | Cost cap | owner-set; pick a conservative default (e.g. 40) and document it |
| `MAX_REFERENCES` | Intake cap | e.g. 25 |
| `REGENERATION_LIMIT` | Successful section replacements | `3` |

### Pricing formula (server only)

```text
targetWords = requestedPages * WORDS_PER_PAGE
subtotalCents = requestedPages * PRICE_PER_PAGE_CENTS
chargedAmountCents = max(subtotalCents, MINIMUM_ORDER_CENTS)
```

Title page and bibliography are **not** billable content words.

### Model IDs

Keep writing and utility model IDs **only** in this config. Verify current
OpenAI snapshot names against
https://developers.openai.com/api/docs/models when implementing. If the live
API differs from the plan’s “GPT-5.6 Terra / Luna” labels, document the exact
IDs used (plan §19.8).

### Validation

On first server access to research APIs, parse env with Zod. Fail closed with a
safe error if required secrets are missing. Never dump env into logs.

### Exit condition

Config module exists. `.env.example` lists names and comments. No secrets in
git. Pricing helpers can be unit-tested with fake env.

---

## C02 — MongoDB connection and Mongoose models

**Plan:** §4.1, §6.1–§6.4, §5.2, Appendix A

**Goal:** Persisted shapes for Order and Paper. Unique indexes. No card data.

### Files

- `lib/db/mongodb.ts` — cached connection for Next.js hot reload
- `lib/models/Order.ts`
- `lib/models/Paper.ts` (references[], outline[], sections[], generation,
  regeneration embedded as specified)

### Order fields (plan §6.1)

`publicId`, `paperId`, `customerEmail`, `requestedPages`, `wordsPerPage`,
`targetWords`, `unitPriceCents`, `subtotalCents`, `minimumChargeCents`,
`chargedAmountCents`, `currency`, `provider: 'bachs'`, `checkoutSessionId`,
`transactionId`, `status`, `idempotencyKey`, `paidAt`, `failureReason`,
timestamps.

Statuses: `created | checkout_created | processing | paid | failed | expired | refunded`

Unique indexes: `publicId`; `checkoutSessionId` sparse; `transactionId` sparse;
`idempotencyKey`.

### Paper fields (plan §6.2)

`publicId`, `customerEmail`, `accessTokenHash`, title/focus/paperType/authors/
citationStyle/pages/targetWords/allowAdditionalSources/researchNotes,
`references[]`, `outline[]`, `sections[]`, `status`, `generation`,
`regeneration`, `editorVersion`, timestamps, `completedAt`.

Statuses: `draft | awaiting_payment | ready | generating | completed | failed`

### Reference subdocument (plan §6.3)

Include `verificationStatus` and `contentStatus` exactly as specified.
`isUserKeyReference`, `isSystemAdded`, `selectedByUser`.

### Section subdocument (plan §6.4)

`contentJson`, `plainText`, word counts, `citedRefIds[]`, generation fields,
checksum.

### Money and tokens

- Integer cents only.
- Store **hash** of recovery token, never the raw token.
- Never store card numbers.

### Tests (start here)

- Schema accepts valid documents and rejects missing required fields (can be
  mongoose validation tests with mongodb-memory-server or a dedicated test db).

### Exit condition

Models compile. Indexes defined. Connection helper is singleton-cached.
Existing Convex contact/subscribe still untouched.

---

## C03 — State-transition services

**Plan:** §6.5, §13

**Goal:** Status changes only through services. Invalid transitions throw.
Webhook and generation calls are idempotent at the service layer.

### Allowed transitions

**Order**

| From | To |
| --- | --- |
| created | checkout_created, failed |
| checkout_created | processing, paid, failed, expired |
| processing | paid, failed |
| paid | refunded |

**Paper**

| From | To |
| --- | --- |
| draft | awaiting_payment |
| awaiting_payment | ready |
| ready | generating |
| generating | completed, failed |
| failed | generating |

On successful terminal payment: **Order → paid and Paper → ready in one safe
operation** (plan §9.3).

### Implementation

- `lib/research/state/orderTransitions.ts`
- `lib/research/state/paperTransitions.ts`
- Use conditions on `findOneAndUpdate` so concurrent webhooks cannot double
  apply.

### Tests (required this chunk)

- Every allowed transition succeeds.
- Every illegal transition is rejected.
- Paying an already-paid order is a no-op success (idempotent).

### Exit condition

No route or model method may `.save()` a status that skipped these services.
Unit tests for the table above pass.

---

## C04 — Shared Zod validation and API error conventions

**Plan:** §3.3, §10, §10.1, §12.3

**Goal:** One validation module used by client-safe types and server routes.

### Paper details

| Field | Rule |
| --- | --- |
| Research title | required, 10–300 chars |
| Research focus | required short description |
| Paper type | `literature_review` \| `research_proposal` \| `original_research_draft` |
| Authors | at least one name; affiliation, department, email, ORCID optional |
| Citation style | stable identifier from supported list, not display label only |
| Pages | integer, `MIN_PAGES`–`MAX_PAGES` |
| Additional sources | boolean |
| Research notes | optional |
| Original research | actual method and findings fields **required** |

### Reference intake

- One reference per repeatable field.
- Input type: DOI, HTTP(S) URL, or citation text.
- Length and count limits from config.

### API errors

Return **machine codes** plus human messages. Never stack traces, secrets,
raw provider payloads, or Mongo `_id` to the browser.

Suggested codes (extend as needed, keep stable):

- `REFERENCE_AMBIGUOUS`
- `REFERENCE_UNRESOLVED`
- `PAYMENT_REQUIRED`
- `PAYMENT_PROCESSING`
- `GENERATION_RETRYABLE`
- `GENERATION_INVALID_OUTPUT`
- `REGENERATION_QUOTA_EXCEEDED`
- `ACCESS_DENIED`
- `VERSION_CONFLICT`
- `SSRF_BLOCKED`
- `RATE_LIMITED`

HTTP: `409` state conflict, `422` business validation, `429` rate limit,
`503` retryable upstream.

Include a `requestId` in logs and in safe client errors.

### Exit condition

`lib/validation/research.ts` covers paper, references, patch, regenerate,
and export query. Invalid payloads fail closed.

---

## C05 — Marketing integration (hero + landing section)

**Plan:** §1.2, §3.1, §17 first bullet

**Goal:** Visitors can reach `/research` without harming the visa conversion
path.

### Changes

1. **Secondary** hero button: label `AI Research Assistant` or
   `Create a Research Paper`. Primary `BookCta` stays first.
2. Short landing section: verified sources, editable drafts, DOCX/PDF.
   Link to `/research`.
3. Reuse existing `Section`, `Button`, colours, type scale.
4. Optional: add a header/footer link only if it does not clutter the visa
   nav. Prefer hero + section if nav is already dense.
5. Update `app/sitemap.ts` to include `/research` when the page exists
   (page can be a placeholder until C06).

### Copy constraints

- Do not claim the tool produces completed original research.
- Do not claim journal acceptance or plagiarism-free publication.

### Exit condition

Desktop and mobile: secondary CTA visible, landing section links to
`/research`, primary Book CTA unchanged. Lint/build still pass.

**Verify in the browser** on `/` (desktop and a mobile width): click both CTAs.

---

## C06 — `/research` shell, steps, and paper-details form

**Plan:** §3.2, §3.3, §3.4, §1.4

**Goal:** Centered unpaid wizard with a step indicator. No Mongo write yet
except what C08 may add locally.

### UX

- Steps: Paper details → References → Review → Payment → Generation → Editor
- Before generation: centered form.
- After generation (later chunks): document workspace. Do not build the editor
  yet.
- Status text plus colour (not colour alone).
- Buttons reachable without horizontal scroll.

### Paper type behavior (surface in the form)

| Type | UI must require | UI must forbid promising |
| --- | --- | --- |
| Literature review | Title, focus, references | Invented experiments |
| Research proposal | Research question, intended method, scope | Completed results |
| Original research draft | Actual methodology, data, findings from the user | AI-invented results |

### Fields

Implement table in plan §3.3 with accessible errors (existing Field/Label
components).

### Local retention

Retain draft input locally (plan §3.2 stage 1) so refresh does not wipe the
form. Do not treat local storage as the source of truth after payment.

### Exit condition

User can complete a valid unpaid details step and proceed to an empty
references step. Invalid fields block progress with accessible messages.

---

## C07 — Reference input list (client, unpaid)

**Plan:** §3.2 References stage, §7.1

**Goal:** Repeatable DOI / URL / citation rows with optional abstract or key
findings notes.

### Behavior

- Add / remove rows.
- Normalize whitespace in the UI for display; **canonical normalize on the
  server** in C12.
- Show per-row state placeholders: pending / verified / uncertain /
  unavailable (wire to API in C13).
- Enforce `MAX_REFERENCES` in the UI and again on the server.

### Exit condition

User can enter mixed DOI, URL, and citation text and continue to Review with
client-side completeness checks (server resolve comes in C13).

---

## C08 — Review step, local persistence, price preview

**Plan:** §3.2 Review, §9.1

**Goal:** Show settings, word target, **server-derived price explanation**,
and source list before checkout.

### Price presentation

- Compute a **preview** from the same formula as config (pages, 300 words,
  $0.25, $2.50 minimum).
- Label it as estimated until the order API returns the authoritative
  `chargedAmountCents`.
- If `MIN_PAGES` is 10, explain the minimum clearly before checkout.
- Never trust a hidden form field for the charge amount.

### Review must show

- Title, type, citation style, page count, target words.
- Author list.
- Each reference as entered (verification badges after C13).
- Additional-sources flag.
- Regeneration limit (3) as a product fact, not a charge line.

### Exit condition

User can review a complete unpaid request. Price math matches unit tests for
the formula. No Bachs call yet.

This is **Phase 2 exit** in the plan: “User can enter and review a complete
unpaid request.”

---

## C09 — Safe-fetch and SSRF guards

**Plan:** §7.1, §12.3, §14.4

**Goal:** URL fetching cannot hit localhost, private ranges, non-HTTP schemes,
or redirects to private addresses.

### Files

- `lib/research/security/safe-fetch.ts`

### Rules

- Allow only `http:` and `https:`.
- Block `localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`,
  `192.168.0.0/16`, link-local, IPv6 loopback/unique-local, cloud metadata
  hosts (`169.254.169.254`, etc.).
- Resolve DNS and re-check IPs after redirects (no open redirect to private
  IP).
- Timeout, max redirects, max body size, accepted content types.
- Treat fetched HTML as untrusted data, never as model instructions.

### Tests (required)

- `http://127.0.0.1/`, `http://localhost/`, `file://`, `169.254.169.254`
  rejected.
- Public HTTPS URL shape accepted by the guard (mock network).

### Exit condition

SSRF tests pass. No other feature depends on fetch until this exists.

---

## C10 — Crossref adapter

**Plan:** §7.2, §7.4, Appendix C

**Goal:** Typed Crossref client. Polite contact email. No UI.

### Docs to verify at implementation

https://www.crossref.org/documentation/retrieve-metadata/rest-api/

### Behavior

- DOI lookup (normalized DOI, strip `https://doi.org/` prefixes).
- Bibliographic query for citation text.
- Map to a canonical internal work record (title, authors, year, journal,
  volume, issue, pages, DOI, URL). Do not treat Crossref’s display string as
  the canonical citation.

### Exit condition

Adapter has a mockable interface. Unit tests with recorded fixtures (no live
network in CI).

---

## C11 — OpenAlex adapter

**Plan:** §7.2, §7.5, Appendix C

**Goal:** Typed OpenAlex client for DOI lookup, title search, and (later)
discovery.

### Docs to verify

https://help.openalex.org/how-to-use-the-api/api-overview

Use `OPENALEX_API_KEY` only if the chosen tier requires it. Always send a
polite User-Agent.

### Exit condition

Same as C10: mockable adapter + fixture tests.

---

## C12 — Reference resolve pipeline and scoring

**Plan:** §7.1–§7.4, §14.1

**Goal:** One function: inputs in, structured candidates out. No LLM.

### Resolution order

| Input | Primary | Fallback |
| --- | --- | --- |
| DOI | Crossref works | OpenAlex by DOI |
| URL | Extract DOI from URL or safe page metadata | Title/author search on both |
| Citation text | Crossref bibliographic query | OpenAlex title search, rank |

### Matching

Rank with: normalized title similarity, year, first-author similarity, DOI
equality. DOI equality is a strong exact match. High title score is **not**
enough when author or year conflicts.

### Status meanings

- **Verified:** identity resolved with sufficient confidence.
- **Content available:** abstract, user excerpt, or legally accessible full
  text for grounding.
- **Metadata only:** work exists; arguments/findings not available.
- **Unverified:** must not enter allowed citation list.
- **Ambiguous:** return top candidates; user must select or reject.

### Evidence

For v1, abstracts and user-provided key findings are the main evidence.
Follow OA links only when technically and legally permitted. **Do not bypass
paywalls.** If no readable evidence, keep verified metadata but do not let
the model attribute detailed claims to that source.

### Merge identity

Prefer DOI as key, then normalized title + year + first author.

### Exit condition

Scoring unit tests cover exact DOI, conflicting year, and ambiguous title.
Unresolved and verified paths are deterministic given fixtures.

This is **Phase 3 core**. Confirmation UI is C13.

---

## C13 — Resolve API + match confirmation UI

**Plan:** §10 resolve route, §3.2, §13 ambiguous citation

### API

`POST /api/research/references/resolve`

Protections: Zod, rate limit (stub OK if C28 will replace with final limiter),
SSRF, timeouts. Do not return full provider JSON.

### UI

- Verified: show canonical title, year, DOI, content status.
- Ambiguous: candidate cards; user must pick or remove.
- Unavailable / unverified: require correction or removal before Review can
  create an order.
- Never label metadata-only as “full text”.

### Exit condition

Phase 3 exit: verified, ambiguous, and unavailable cases behave correctly in
the unpaid flow.

**Browser:** submit a DOI, a garbage citation, and an ambiguous title fixture
(or mocked API).

---

## C14 — Additional source discovery

**Plan:** §7.5

**Goal:** Only when `allowAdditionalSources` is true.

### Steps in code

1. Derive a small concept set from title, focus, and confirmed key refs
   (utility model **or** deterministic keyword extract; if LLM, Luna only,
   structured JSON, tight token cap).
2. Query OpenAlex with a configurable max.
3. Prefer DOI + abstract + suitable type + topical relevance.
4. Verify DOI via Crossref, dedupe against user sources, mark `isSystemAdded`.
5. User must still be able to deselect system sources before pay.
6. Never force an irrelevant key reference into a later paragraph (generation
   rule; enforce again in C19–C21).

### Exit condition

Flag off → no system sources. Flag on → capped, labeled, deduped, user
selectable.

---

## C15 — Access tokens, pending paper/order, Bachs checkout

**Plan:** §9.2, §10 orders, §12.2

**Hard rule:** No generation in this chunk.

### Access token

- Generate ≥32 random bytes.
- Show raw token **once** to the customer (page + optional email later).
- Store only a peppered hash (`RECOVERY_TOKEN_PEPPER`).
- After first successful token exchange, prefer HttpOnly, Secure, SameSite
  cookie.
- `publicId` is not auth.

### `POST /api/research/orders`

1. Validate paper + references on the server (all unresolved refs blocked).
2. Recalculate words and price on the server. Ignore client amounts.
3. Create Paper `awaiting_payment` and Order `created` together.
4. Create Bachs checkout: customer email, success URL, cancel URL, metadata
   **only** public order id.
5. Store checkout session id; Order → `checkout_created`.
6. Return hosted checkout URL + public ids + (if needed) one-time token
   display strategy that does not leak via logs.

### Bachs

Verify current checkout, currency, and auth against
https://docs.bachs.io/introduction and API keys docs at implementation time.
Wrap in `lib/research/payments/bachs.ts`.

### Idempotency

Honor `idempotencyKey` so double-click does not create two charges/papers.

### Tests

- Mock Bachs: order created with server price.
- Client tampered price is ignored.
- Unverified refs → 422, no checkout.

### Exit condition

Sandbox checkout URL returned. Paper cannot generate. Webhook not required
yet, but order exists.

---

## C16 — Bachs webhook, return pages, status poll

**Plan:** §9.3, §9.4, §10 webhook, §13 payment rows, §17 payment bullets

**Hard rule:** Redirect ≠ paid. Generation stays locked until webhook success.

### `POST /api/research/payments/webhook`

- HTTPS route; **raw body** before JSON parse (`next.config` body parser
  settings as required).
- Verify `X-Bachs-Timestamp` and `X-Bachs-Signature` (HMAC SHA-256, timing
  safe) with replay window.
- Reject bad signatures, stale timestamps, unknown orders.
- Map provider states deliberately.
- Before `paid`: match metadata, expected amount, paid amount, currency.
- Unique event/transaction id: duplicates return success without side effects.
- Then: Order `paid`, Paper `ready` in one safe operation.

### Pages

- `app/research/payment/success/page.tsx` — “Processing payment”, poll
  `GET /api/research/papers/[id]` (token required). Never unlock locally.
- `app/research/payment/cancelled/page.tsx` — unpaid paper kept; retry
  checkout without duplicate paid orders.

### Reconciliation

Store provider ids and amount actually paid. Add a protected script or server
function to fetch a Bachs transaction when disputed (can be a `pnpm` script
gated by env, not a public route).

Refunds: **manual only** until the owner approves automatic refunds.

### Tests (required)

- Valid signature pending → paid.
- Duplicate webhook: no second transition, no second side effect.
- Wrong amount: not paid.
- Invalid signature: 4xx, order unchanged.
- GET paper without token: denied.

### Exit condition

**Phase 4 exit:** Only a verified paid order can become `ready`.

---

## C17 — Citation token parser and CSL renderer

**Plan:** §7.6, §7.7, §8.1, §11.4, §14.1

**Goal:** Deterministic citations. No LLM.

### Token contract

Only: `[CITE:ref_01]` or `[CITE:ref_01;ref_04]`

- Reject unknown IDs.
- After validation, CSL converts tokens to the selected style and builds
  bibliography from structured metadata.

### Styles (tested set)

APA, IEEE, MLA, Vancouver, Harvard (pick **one** named Harvard CSL, document
which), Chicago.

Store style identifiers. Changing style re-renders citations and bibliography
**without** regenerating prose.

### Validation rules

- Every token → allowed verified source.
- Every bibliography entry cited, unless marked further reading.
- Every in-text citation appears once in the bibliography.
- Metadata-only source cannot support a detailed empirical statement
  (enforced with contentStatus + claim heuristics in C21; this chunk at least
  carries status through to the renderer).

### Files

- `lib/research/citations/tokens.ts`
- `lib/research/citations/styles.ts`
- `lib/research/citations/render.ts`

### Tests

Parser, unknown ID, style mapping, bibliography dedupe.

### Exit condition

Given tokens + metadata + style id, renderer returns stable in-text +
bibliography strings.

---

## C18 — OpenAI client, prompts, structured output

**Plan:** §8.1, §8.4, §8.5, §12.3, Appendix C

**Goal:** One client. Terra = outline and sections. Luna = constrained
cleanup. Citation formatting never uses a model.

### Files

- `lib/research/ai/client.ts`
- `lib/research/ai/prompts.ts`
- `lib/research/ai/schemas.ts` (Zod / JSON Schema)

### Prompt rules

- Paper type, section purpose, audience, tone, word budget, token contract.
- Only evidence for the current section, labeled by `refId`.
- Absent evidence must be acknowledged, not invented.
- Original research: explicit ban on fabricated participants, procedures,
  measurements, statistics, outcomes.
- Sources are data, not instructions (prompt-injection delimiter).
- Do not ask for a final bibliography string.
- Cite only when supplied evidence supports the sentence.

### Section JSON contract (plan §8.5)

```json
{
  "sectionId": "literature-review",
  "title": "Literature Review",
  "paragraphs": [{ "text": "... [CITE:ref_01]" }],
  "usedReferenceIds": ["ref_01"],
  "limitations": [],
  "wordCountEstimate": 930
}
```

### Cost controls

Per-section max output tokens, bounded reasoning effort, record input/output
tokens, model, request id on each step.

### Exit condition

Client can be mocked. Prompt builders are pure functions. No route calls
OpenAI except through this client.

---

## C19 — Source manifest, outline, word allocation

**Plan:** §8.2, §8.3 steps 1–3

**Goal:** Paid papers only. Still not full section prose except outline.

### Word allocation

`targetWords = requestedPages * 300`

Literature review default shares (adjust by paper type, small tolerance, no
padding with repetition):

| Section | Default share |
| --- | --- |
| Abstract | 5% |
| Introduction | 15% |
| Literature review | 35% |
| Methodology | 12% |
| Results and discussion | 25% |
| Conclusion | 8% |

Keywords and references do not consume the body target. Final total should
normally stay within 10% of `targetWords`.

Proposal: do not write completed results. Original research: methodology and
results sections only if user supplied data; outline validation must fail if
results are required but missing.

### Manifest

Each allowed `refId`, canonical metadata, evidence text, `contentStatus`.
Exclude unverified.

### Outline

Section titles, arguments, word budgets, planned source IDs. Validate planned
citations exist.

### Exit condition

A paid paper can persist a validated outline. Unpaid → `PAYMENT_REQUIRED`.

---

## C20 — `generate-next` orchestration

**Plan:** §4.3, §8.3 steps 4–5, §8.6, §10 generate-next, §13 AI timeout

**Goal:** Resumable generation. **One pending step per request.**

### `POST /api/research/papers/[id]/generate-next`

Protections: paid order, access token, lock, idempotency, rate limit.

### Algorithm

1. Reject if paper not `ready` or `generating` or `failed` (failed may retry).
2. Claim exactly one pending step (outline if missing, else next section).
3. Set `generation.lockUntil`. Concurrent callers get 409/retryable.
4. Execute step, persist, release lock.
5. Idempotency key: `paperId + sectionId + generationVersion`.
6. Retry only transient timeouts/rate limits with bounded exponential backoff.
7. Do not silently retry invalid source IDs, schema violations beyond one
   repair (C21), missing payment, or prohibited output.

Do **not** depend on one long-running serverless request for the whole paper.

If the host still kills individual section calls, replace **only** this
orchestration with Trigger.dev/Inngest later. Keep paper and generation-state
interfaces unchanged (plan §4.3).

### Progress

Persist `currentStep`, `completedSteps[]`, `lastError`, `attempts`, token
totals.

### Tests

- Unpaid denied.
- One section persisted per successful call.
- Second concurrent lock fails safely.
- Repeat same idempotency key does not duplicate the section.

### Exit condition

A paid sandbox paper can advance step by step to completed sections without
the editor yet.

---

## C21 — Section validation, repair, coherence

**Plan:** §8.3 steps 5–7, §7.7, §13 invalid citation

### After each section

Validate structured output, citation IDs, word count band, prohibited claims
**before** save.

If invalid citation IDs: reject, **one** constrained repair attempt, then
surface failure.

### Coherence pass

Narrow repairs only. Must not introduce new references or unverified facts.
Then deterministic CSL render and mark paper `completed`.

### Claim vs evidence

- Strong factual claim without citation → flag for repair or user review.
- Detailed empirical statement + metadata-only source → reject that citation
  use.

### Exit condition

Invalid `[CITE:ref_99]` never persists. Coherence cannot add new ref IDs.

---

## C22 — Generation progress UI and recovery resume

**Plan:** §3.2 Generation, §3.4, §12.2, §13 browser closes, §17 resume

### UI

- Real section progress (text + colour).
- Safe to leave and return.
- Recovery URL uses `publicId` + token (token in fragment or one-time query
  exchanged for cookie; prefer not to keep token in history long term).

### Resume

If the browser closes, recovery page reads saved state and continues from the
**first incomplete step** by calling `generate-next` again.

Optional email recovery only if `EMAIL_*` configured; otherwise on-screen
token is enough.

### Paper route

`app/research/paper/[paperId]/page.tsx` + `GET /api/research/papers/[id]`
projection **excluding** secrets and token hashes.

### Exit condition

**Phase 5 exit:** Paid sandbox paper completes and resumes after interruption.

**Browser:** start generation, stop mid-way, reopen recovery link, finish.

---

## C23 — TipTap editor, citation nodes, sources panel

**Plan:** §3.4, §11.1, Appendix A components

### Layout

- Desktop: outline + main editor; sources in drawer or side panel.
- Mobile: stacked; Outline and Sources as sheets/tabs.

### Editor

- TipTap JSON is source of truth.
- Derived plain text for word counts and export.
- Citation nodes/tokens are **atomic** (ordinary typing cannot corrupt IDs).
- Selecting a citation shows source details.

### Components

`ResearchEditor.tsx`, `SourcesPanel.tsx`, outline list from saved sections.

### Exit condition

Completed paper loads in the editor with visible citations. Existing marketing
pages unaffected.

---

## C24 — Autosave

**Plan:** §11.2, §10 PATCH, §13 autosave conflict

### `PATCH /api/research/papers/[id]`

- Access token, schema validation, optimistic `editorVersion`.
- Debounce on change; save on navigation when possible.
- Stale writes → `409`, offer reload (no silent overwrite).
- UI: Saving / Saved / Save failed.
- Settings that change price are **not** patchable after pay.

### Exit condition

Edits persist across refresh. Two tabs: older version does not clobber newer.

---

## C25 — Section regeneration

**Plan:** §11.3, §12.4 regeneration, §14.2 quota

### `POST /api/research/papers/[id]/regenerate`

1. One section id + optional bounded user instruction.
2. Check paid order and remaining quota (`used` vs `limit`, default 3).
3. Same verified source manifest; **forbid new citation IDs**.
4. Generate into a temporary field, validate, then replace that section only.
5. Increment `used` only after a valid save. Provider failures do not consume
   quota.

### Tests

Three successes then fourth blocked. Failure does not increment.

### Exit condition

**Phase 6 exit:** Edits persist and one section can be safely replaced.

---

## C26 — Normalized export model and DOCX

**Plan:** §11.5, §10 export

### Rules

- From saved structured content, **not** browser HTML.
- Include title, authors, affiliation, abstract, keywords, sections,
  references.
- Readable academic typography, margins, heading hierarchy, page numbers,
  hanging indents where the style requires.
- Sanitize filename and content. Never execute embedded HTML/scripts.

### `GET /api/research/papers/[id]/export?format=docx`

Token required. Completed or user-approved draft state only.

### Exit condition

DOCX opens in Word/LibreOffice with headings and citations present.

---

## C27 — PDF export

**Plan:** §11.6

### Rules

- Same normalized export model as DOCX so content matches.
- Dependable fonts; test long URLs, long bibliographies, non-ASCII names.
- Stay within serverless size/time limits.
- Correct `Content-Type` and `Content-Disposition`.

Export failure must not consume regeneration quota or corrupt the paper.

### Exit condition

**Phase 7 exit:** Both files open and contain matching content.

---

## C28 — Hardening: rate limits, privacy, logging, retention

**Plan:** §12, §16.2, §17 secrets/rate-limit bullets

### Rate limits

Per IP and per paper on resolve, orders, generate-next, regenerate.
Reuse patterns from `convex/rateLimit.ts` conceptually, but implement for
these Next routes (do not accidentally rate-limit visa contact via research
config).

### Logging

Structured: `requestId`, public order id, public paper id, operation,
duration, safe status.

**Never log** paper body, full source text, access tokens, or secrets.

Track: checkout creation, paid conversion, generation completion, duration,
failure by step, token cost, reference-resolution success, export failures.

### Privacy

Plain notice: customer email, topics, references, generated content, payment
identifiers, processors (OpenAI, Bachs, MongoDB, Crossref, OpenAlex, email).

Define retention period and a deletion path **before launch** (script or
protected action). Do not expose papers via analytics or guessable URLs.

### Policy on site

AI-draft disclosure, pricing definition, refund/retry policy visible near
checkout and footer as appropriate. Do not invent legal guarantees.

### Spend

Document owner need for OpenAI project spend alerts plus an application-level
daily alarm if feasible.

### Exit condition

Critical routes limited. `.env.example` complete. Privacy/disclosure copy
merged. No secrets in client bundles (grep `NEXT_PUBLIC` and client imports).

---

## C29 — Full testing strategy

**Plan:** §14, §17 tests bullet, §19.7

Implement any missing tests from earlier chunks. CI should run unit +
integration with mocks. E2E against sandbox/mocks.

### Unit (plan §14.1)

- DOI/URL normalize, input detection, candidate scoring
- Money, pages→words, minimum charge
- Order/paper transition guards
- Citation tokens, unknown IDs, bibliography, CSL map
- Webhook HMAC, replay window, timing-safe compare
- Access-token hash compare

### Integration (plan §14.2)

- Resolve with recorded Crossref/OpenAlex fixtures
- Mock Bachs checkout create
- Signed webhook pending→paid including duplicate
- Paid-only generation; one section per step
- Regeneration quota and failure
- DOCX/PDF non-empty with headings and citations

### E2E (plan §14.3)

1. Literature review with DOI + citation, sandbox pay, generate, edit,
   download.
2. Ambiguous citation → user selects candidate.
3. Generate before pay → denied.
4. Close during generation → recovery resume.
5. Three regenerations then fourth blocked.
6. Change citation style: prose unchanged, citations/bibliography update.

### Adversarial (plan §14.4)

- Source contains prompt-injection; treated as data.
- Localhost/metadata URL blocked.
- Fabricated `refId` rejected.
- Original research without findings does not invent results.
- Browser price tampering still charges configured amount.

### Exit condition

**Phase 8 exit:** Critical acceptance tests pass in preview. Existing site
still lints and builds.

---

## C30 — Production cutover (owner-gated)

**Plan:** §15 Phase 9, §16, §2.1, §19.9

**Stop.** Do not run live credentials, production webhooks, or real charges
without explicit owner approval.

### Owner setup (plan §2.1)

| Owner task | Result |
| --- | --- |
| MongoDB Atlas | Project, network allowlist, least-privilege user, `MONGODB_URI` in host secrets |
| OpenAI | Production project, billing, project key, spend alerts, `OPENAI_API_KEY` |
| Bachs | Sandbox **and** live, verification, product or ad-hoc pricing, HTTPS webhook, API key + signing secret |
| Reference APIs | Key only if required; Crossref contact email |
| Hosting | Env vars, domain, serverless timeout/size limits |
| Email | Optional recovery sender |

### Production checklist (plan §16.3)

- Indexes created; backups understood
- Live keys only in host secret store
- Production webhook HTTPS; signature tested
- Return/cancel URLs use production domain
- OpenAI spend protection on
- Privacy, AI-draft disclosure, pricing, refund/retry visible
- Mobile, long papers, long names, long reference lists tested
- Visa SEO, nav, and Book CTA intact

### Exit condition

**Phase 9:** One real **low-value** live order completes and reconciles.
Agent does not perform this without owner consent.

---

## Acceptance criteria (must all be true at C29)

Copied from plan §17 for a single checklist:

- Visitor reaches `/research` from hero and landing section.
- Fields validate with accessible errors and persist during ordinary
  navigation.
- DOI, URL, and citation inputs show verified, ambiguous, or unresolved.
- Metadata-only access is never described as full source access.
- Price and word target calculated on the server from config.
- Generation impossible until signed Bachs payment confirms the order.
- Repeated payment events and generate calls do not duplicate charges, papers,
  or sections.
- Complete paper has required sections for its paper type.
- Every model citation token resolves to an allowed verified reference;
  bibliography is deterministic.
- Original research without supplied results never gets invented results.
- Generation resumes after browser close or transient failure.
- Users can edit, autosave, regenerate within quota, export matching DOCX and
  PDF.
- Secrets stay server-side; access requires recovery token; critical routes
  are rate limited.
- Tests cover payment integrity, citation validity, recovery, and pricing.
- Existing website still builds, lints, and renders.

---

## Explicitly out of scope until the owner expands the plan

Plan §1.3 and §18:

- Subscriptions, wallets, stored cards, overage billing
- User accounts, dashboards, collaboration, comments
- PDF upload, OCR, private vector DBs
- Plagiarism scoring, journal submission, peer review, human editing
- Invented datasets, participants, experiments, stats, findings
- Extra journal templates beyond the supported citation styles
- Admin dashboards, automated refunds, advanced support tooling

---

## Suggested session protocol

When implementing, the coding agent should:

1. Name the chunk (e.g. C15).
2. Re-read the cited plan sections in this file.
3. Implement only that chunk’s files and tests.
4. Run the chunk’s tests plus `pnpm lint` (and `pnpm build` if routes/pages
   changed).
5. For UI chunks (C05–C08, C13, C16, C22–C25): verify in the browser, not
   screenshot-only.
6. Stop and report: files, commands, results, risks, owner setup.

Next chunk after this document is accepted: **C00**.
