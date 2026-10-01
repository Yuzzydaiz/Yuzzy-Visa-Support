# Review, ai-research-paper-gen, 2026-10-02

**Reviewed by**: deepseek-flash (author on deepseek-flash)
**Scope**: 149 files, branch vs main (15 tracked + 134 untracked, base `5f3d018`)
**Verdict**: Blocked

> **Cross-model guarantee degraded.** The process calls for a reviewer on a
> different model than the author. No second model is available in this
> environment, so reviewer and author are the same family (`deepseek-flash`).
> Findings come from reading the code and running the configured gates
> (`pnpm exec tsc --noEmit` exits 0; `vitest run` on the generation/config/repair
> files passes 30 tests), not from independent model diversity. Treat this as a
> single-model self-review.

## Summary

This is the final pass on the Yuzzy AI research writer: the earlier blocker
(regeneration not updating the canonical `editorDocument`), the canonical-document
initial load, regeneration token totals, the shared Mongo rate limiter, LLM
timeouts, retention purge, and the generation-lease-vs-timeout budget are all
genuinely closed and regression-tested. The one remaining release-blocking issue is
the SSRF guard: `safeFetch` validates a hostname's DNS answers and then lets `fetch`
resolve the hostname a second time, so a rebinding attacker can reach the
private/link-local/cloud-metadata addresses the guard claims to block. The other
notable issue is the new "soft issue" policy in `generateSectionJson`: a section that
still fails word-count or uncited-empirical checks after one repair is accepted and
only logged server-side, with no persisted or user-visible flag, so the plan's
"flag for repair or user review" never reaches the user.

## Blockers

### 🔴 SSRF guard is bypassable via DNS rebinding; the validated IP is not the IP fetched, `lib/research/security/safe-fetch.ts:140-174`
**Problem**: `assertResolvedPublic` resolves the hostname (`lookup` at `:140`, checks every answer at `:144-148`) but `safeFetch` then calls `fetchImpl(current.toString())` (`:169`), which performs its own independent DNS resolution. Nothing pins the connection to the checked addresses. Although `assertResolvedPublic` is re-run on each redirect, it is always followed by a fresh hostname lookup inside `fetch`, so a hostname whose authoritative DNS answers with a public IP for the check and a private IP shortly after (TTL 0, classic DNS rebinding) connects to the private address. Only static hostnames (`localhost`, `169.254.169.254`, etc.) and stable private-range answers are blocked; the explicit plan requirement (BUILD_CHUNKS C09, "Resolve DNS and re-check IPs ... no open redirect to private IP") is not met for rebinding.
**Why it matters**: `safeFetch` is reached pre-authentication from `POST /api/research/references/resolve` with a user-supplied URL (`lib/research/references/resolve.ts:116-118`), so any anonymous attacker can make the deployed function issue a GET to internal services or the cloud metadata endpoint. The response body is not returned to the caller (it is regex-mined for a DOI/`<title>`), so this is a blind SSRF rather than direct exfiltration, but it can still reach internal control planes that act on GET and can be turned into a data oracle via timing/errors. This is exactly the class of hole the guard exists to prevent. The existing test (`tests/unit/safe-fetch.test.ts:38`) mocks `lookup` and `fetchImpl` as a redirect chain, so it never exercises a same-host rebind and passes today.
**Suggested fix**: Do not let `fetch` re-resolve. Resolve once, validate the addresses, then connect to the validated IP directly (e.g. an undici `Agent`/`Dispatcher` with a `lookup` that returns the pinned address, or connect-by-IP with the original `Host`/SNI preserved), and re-pin on every redirect hop. Add a regression where `lookup` returns a public address on the pre-check and a private address on the connection attempt and assert it is rejected.

## Major

### 🟠 Soft validation failures are accepted but never surfaced to the user, `lib/research/generation/next.ts:289-317`
**Problem**: After the single repair attempt, only `unknown_cite` and `metadata_only_claim` are fatal (`:289-300`); a remaining `uncited_claim` or an out-of-band `word_count` is logged via `section-soft-issues` (`:304-316`) and the section is returned and persisted. The issue list is not written to `generation.lastError`, not stored on the section (the `SectionSchema` has no issue field), and not shown by `paper-progress.tsx`/`paper-workspace.tsx`. So a literature review or research proposal can persist a fabricated empirical sentence with no citation token — or a section far outside its budget — and the paying user gets no warning. BUILD_CHUNKS C21 and the repair plan both call for such a claim to be "flag[ged] for repair or user review"; only the repair attempt happens, and review is impossible from the data the client receives.
**Why it matters**: The product rule is "Original research must never invent participants, procedures, measurements, statistics, or outcomes" and metadata-only sources must not back detailed claims. Uncited empirical claims are the remaining hole: `metadata_only_claim` is fatal, but the same fabricated statistic with no citation at all is silently accepted. Because the user is never told, the "user can edit it" mitigation does not actually apply. (R08 is not affected: `maybeCoherence` re-runs `validateSectionOutput` and rejects any issue, including `uncited_claim`, at `next.ts:396-413`, so this gap is specific to first-pass generation.)
**Suggested fix**: Persist a per-section flag (or `generation.lastError`/a review summary) when soft issues survive repair, and render it in the progress/editor UI as "needs review". Alternatively, treat a residual `uncited_claim` in non-original-research types as fatal after repair, or strip/annotate the offending sentence. Add a test asserting the issue is surfaced, not just logged.

## Minor

### 🟡 Shared rate limiter is opt-in and fails open, `lib/research/http/rateLimit.ts:110-114,148-163`
In production the limiter is per-instance unless `RESEARCH_RATE_LIMIT_STORE=mongo` is explicitly set (`:113`), and even then any store error silently degrades to the in-process map (`:158-163`). The unauthenticated, LLM-spending `discover` route (`lib/research/discovery/http.ts:94-101`) and `resolve` rely on this. Fail-open is documented as an owner decision, but "critical routes are rate limited" only holds if the operator sets the env var, and a Mongo blip removes the shared window entirely. Consider defaulting the store on in production or gating the LLM path to a global budget.

### 🟡 Generation lease can outlive the route `maxDuration`; the clamp comment is wrong, `lib/config/research.ts:238-245,263-270`
`parseTimeoutMs` clamps to 600 s (`:244`) while `generate-next`/`regenerate` declare `maxDuration = 300` (`app/api/research/papers/[id]/generate-next/route.ts:6`). `generationLeaseMs` is `2*writing + 4*utility + 30s`, so with `LLM_TIMEOUT_MS=600000` the lease can be ~60 minutes while Vercel kills the function at 5. The kill does not run the release path, so the paper stays locked for the rest of the lease and resume is blocked. The comment "Clamp so a very large timeout cannot outlive a route's maxDuration" is therefore false. Clamp `parseTimeoutMs` below the smallest consuming route `maxDuration`, or derive both from one constant, and add a test asserting `generationLeaseMs <= maxDuration`.

### 🟡 Regeneration quota increment uses a pre-claim read, `lib/research/generation/regenerate.ts:140-141,261-264`
`used`/`limit` are read before `claimRegeneration` and the final write is `paper.regeneration = { used: used + 1, limit }` (`:261-264`). The lock serializes concurrent regenerations, so the common case is correct, but a request delayed between the read and its claim (the shared limiter's `await` sits in that window, `:121-132`) can read `used=0`, let a previous regeneration commit `used=1`, then claim and write `used=1` again — undercounting a successful regeneration and granting a free one. Prefer `$inc: { "regeneration.used": 1 }` in the ownership-conditioned finalize (or re-read inside the claim) rather than assigning an absolute value derived from a stale snapshot.

### 🟡 Bachs client has no request timeout, `lib/research/payments/bachs.ts:35,73-78`
`createCheckout` and `getTransaction` call `fetchImpl` without an `AbortSignal`. A hung Bachs API stalls `POST /orders` (maxDuration 60) and `POST /orders/retry` until the platform timeout; the LLM, Crossref, and OpenAlex paths all got timeouts in the finish-ups. Add `AbortSignal.timeout` for parity.

### 🟡 `safeFetch` reads the whole body before enforcing `maxBytes`, `lib/research/security/safe-fetch.ts:205-208`
`Buffer.from(await response.arrayBuffer())` materializes the entire payload, then checks `buffer.byteLength > maxBytes`. A hostile server can force memory up to the platform limit despite the 512 KB cap. Stream and abort once the cap is exceeded. (Previously recorded as deferred; still real.)

### 🟡 Export model duplicates the abstract and always emits empty keywords, `lib/research/export/model.ts:75-77,108`
The abstract section is captured into `abstract` and also kept in `sections`, so DOCX/PDF render it twice, and `keywords` is hard-coded `[]` although the renderers support keywords. This makes the exported files not match the intended structure. (Deferred nit in the repair plan; still real.)

## Nits

- ⚪ `components/research/citation-extension.ts:29`, the editor renders citations as `[ref_01]` raw ids, not the paper's numbered/author-date label; R09's "editor citation labels" is only satisfied in the rendered text/export, not while editing.
- ⚪ `components/research/research-wizard.tsx:258`, the client hard-codes `chargedAmountCents: 1`; harmless because the server ignores it, but shipping a tamper value in the product flow is confusing.
- ⚪ `lib/research/export/model.ts:60`, `buildCitationContext` is rebuilt for every section inside the loop (O(sections²)); build it once before the loop.
- ⚪ `app/api/research/papers/[id]/route.ts:15`, the access token is still accepted via query string; a fragment/one-time exchange would avoid proxy/referrer logging.
- ⚪ `lib/research/http/rateLimitStub.ts:1`, pure re-export of the real limiter; tests could import `rateLimit` and delete the indirection.
- ⚪ `lib/research/http/rateLimit.ts:33`, `resetResearchRateLimit()` clears only the in-process map, not the shared store, despite its general name.

## Strengths

- The R01–R10 repair work is real and regression-tested: conditional `$set` writes for editor versions/generation/regeneration ownership (`orders/store.ts:156-315`), canonical `editorDocument` rebuild on regeneration (`generation/regenerate.ts:41-69,260`), paper-wide citation numbering from one ordered context (`citations/render.ts:93-99`), and coherence replacements re-validated before acceptance (`generation/next.ts:396-413`).
- Payment integrity is handled carefully: raw-body HMAC with a replay window and timing-safe compare (`payments/webhook.ts:17-42`), amount/currency re-checks, a unique event store for idempotency, and a transaction for the paid→ready transition (`state/orderTransitions.ts:165-228`). Generation is gated on paper status, which only the webhook can move to `ready`.
- The generation lease now derives from the configured timeouts and the backoff wrapper is bounded to one attempt, closing the prior double-spend-under-degradation Major; the timeout/fallback classification never falls back on 4xx client errors (`ai/client.ts:67-76,316-343`).
- Retention is safe by construction: it uses the Mongoose models (so it cannot drift from the uncountable `paper` collection), the maintenance route fails closed without `CRON_SECRET` with a length-checked `timingSafeEqual`, and dry-run is supported (`maintenance/purge.ts`, `app/api/research/maintenance/purge/route.ts:10-31`).

## Test coverage

Configured suite (vitest unit/integration + Playwright e2e). I verified `pnpm exec tsc --noEmit` exits 0 and ran `tests/unit/generate-next.test.ts`, `tests/unit/research-config.test.ts`, and `tests/unit/research-repairs.test.ts`: 30 tests passed. Coverage is broad and meaningful: paid-only gating, webhook idempotency/amount/signature, isolated-Mongo claim/lease/stale-owner concurrency, provider fallback and timeout abort, lease-budget growth, coherence rejection, editor-document round-trips, retention dry-run/cascade/401, and paper-wide citation numbering. Gaps that matter: (1) no test exercises a same-host DNS rebind, so the SSRF blocker passes CI; (2) no test asserts a soft `uncited_claim` is surfaced to the user (the existing test only asserts the section is accepted); (3) no test asserts `generationLeaseMs` stays within the route `maxDuration`; (4) the live `v01-sandbox` acceptance journey remains gated behind `RUN_V01` and skipped by default CI.
