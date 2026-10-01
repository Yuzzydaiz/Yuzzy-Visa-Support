# Review, ai-research-paper-gen, 2026-10-01 (finish-ups)

**Reviewed by**: deepseek-flash (author on deepseek-flash)
**Scope**: 148 files, branch vs main (15 tracked + 133 untracked)
**Verdict**: Changes requested

> **Cross-model guarantee degraded.** The process calls for a reviewer on a
> different model than the author. No second model is available in this
> environment, so reviewer and author are the same family (`deepseek-flash`).
> Findings come from reading the code and running the configured gates
> (`tsc --noEmit` exit 0; the four finish-up test files pass, 30 tests), not from
> independent model diversity. Treat this as a single-model self-review.

## Summary

This pass ("finish-ups") adds a shared Mongo-backed fixed-window rate limiter,
request timeouts for the LLM client with retry/fallback classification,
automated retention (purge cascade + self-serve delete + a daily Vercel cron),
and `maxDuration` exports, on top of the previously reviewed research feature.
The prior blocker (regeneration not updating the canonical `editorDocument`) and
the other post-review fixes are genuinely closed and regression-tested. The
remaining significant issue is an operational one: the 2-minute generation lease
is much shorter than the worst-case per-step LLM budget once request timeouts,
provider fallback, and the 3-attempt backoff wrapper multiply together, so under
provider degradation the lease can expire mid-step, allowing a duplicate
concurrent generation (double spend) and discarding the first request's work.
The rest are minors around discovery timeouts, token-alarm accounting, and purge
scale.

## Major

### 🟠 Generation lease (2 min) is shorter than the worst-case single-step LLM budget, `lib/research/generation/next.ts:58`
**Problem**: `LOCK_MS = 2 * 60 * 1000` (120s). The client resolves each call's
timeout as `timeoutMs ?? spec.timeoutMs ?? 60_000` (`lib/research/ai/client.ts:262`)
and, on a retryable timeout, `createFallbackLlmClient` tries the next provider
with the *same* timeout (`client.ts:316-343`). `completeJsonWithBackoff` then
retries the whole fallback chain up to 3 times (`lib/research/ai/retry.ts:9`).
A single writing step can therefore issue up to 3 × (primary 60s + fallback 60s)
= 360s of provider waiting; adding one utility repair (30s × the same
multiplier) and the coherence call (`next.ts:620-635`) pushes a step far past
120s. `claimGeneration` explicitly reclaims a lease once `lockUntil <= now`
(`lib/research/orders/store.ts:187-191`), and regeneration uses the same 120s
lock (`lib/research/generation/regenerate.ts:199,216`).
**Why it matters**: Under a slow or degraded provider (exactly when timeouts
fire), request A's lease expires while it is still generating; request B claims
the same step and runs it again, so the customer is billed twice at the provider
and the section is generated twice. A's `savePaperIfGenerationOwner` then fails
owner-match (`store.ts:215-239`) and the request returns `409 VERSION_CONFLICT`,
discarding all of A's provider spend (its token totals are never persisted).
This contradicts repair R03.4 ("Renew a lease if needed, with a bound on request
duration") and the plan's bounded-spend rule.
**Suggested fix**: Make the lease cover the real budget (e.g. derive
`lockUntil` from `maxDuration` minus a safety margin), renew/heartbeat the lease
during long calls, and/or cap total attempts per step. At minimum ensure
`LOCK_MS > (writing timeout + fallback) × attempts + utility repair + coherence`
for the configured values, and add a regression that expires a lease mid-step
and asserts a second claim cannot run the same step.

## Minor

### 🟡 Discovery concept extraction still has no timeout and bypasses the new LLM timeout path, `lib/research/discovery/concepts.ts:58`
`extractConceptsWithLuna` calls `fetch("https://api.openai.com/v1/chat/completions",
...)` with no `AbortSignal`, and `handleReferenceDiscover` awaits it
(`lib/research/discovery/http.ts:96`). The finish-up added `AbortSignal.timeout`
to the LLM client and to Crossref/OpenAlex, but this path is untouched, so a
hung OpenAI request stalls the unauthenticated `discover` route for its whole
`maxDuration = 120` before the platform kills it. The REPAIR_PLAN records this
as a known limitation; it is still a real gap in the timeout work.

### 🟡 Daily token-spend alarm is fed cumulative totals as if they were per-call deltas, `lib/research/http/log.ts:91`
`recordTokenUsage` accumulates `tokenTotal += inputTokens + outputTokens` per
call, but callers pass the paper's cumulative totals after each save:
`next.ts:668-671` passes `savedGeneration.totalInputTokens/totalOutputTokens`,
and `regenerate.ts:269-272` passes `paper.generation.totalInputTokens`. Because
each step re-adds the running total, `tokenTotal` grows quadratically, so
`RESEARCH_DAILY_TOKEN_WARN` fires far too early and reports a meaningless
number. Fix by passing per-call usage (the `LlmResult.usage` already available
in `generateSectionJson`) or by computing deltas before recording.

### 🟡 Purge is N+1 and unbounded inside a 60s route, `lib/research/maintenance/purge.ts:58`
`purgeExpiredResearch` loads all expired papers (`.select({ publicId: 1 })`,
no `limit`/pagination) and, for each, issues a separate `Order.find` in
`orderIdsForPaper` (`purge.ts:31-34, 63-72`), then three sequential deletes per
paper. `app/api/research/maintenance/purge/route.ts:8` declares
`maxDuration = 60`. A large backlog (the retention default is 365 days) can
exceed the route budget and leave a partially applied purge while the cron run
is reported as a success by Vercel. Prefer a bounded batch (cursor + limit) and
`deleteMany` by collected ids.

### 🟡 Manual delete script ignores `RESEARCH_RETENTION_DAYS`, `scripts/research-delete-paper.ts:3`
`RETENTION_MS` is hard-coded to 365 days, while the automated purge reads
`RESEARCH_RETENTION_DAYS` with the same default (`purge.ts:24-29`). If the
operator changes the env var, the manual and automated paths disagree. Use
`parseRetentionDays` here too.

### 🟡 Shared-limiter fail-open can double-count and silently degrade on upsert races, `lib/research/http/rateLimit.ts:102`
When `RESEARCH_RATE_LIMIT_STORE=mongo` and the store throws after a first scope
was already consumed, the catch falls through to the in-memory limiter and
re-consumes every scope (`rateLimit.ts:115-124`), so the ip scope can be counted
twice for one request. Also, concurrent first-time upserts on the same `key`
can raise E11000, which the same catch swallows and silently downgrades the
request to per-instance limiting. Low impact (fail-open is intentional), but the
partial double-count and the race are worth a bounded retry/merge rather than a
silent fall-through.

## Nits

- ⚪ `lib/models/RateLimit.ts:6`, `key` declares both `unique: true` and `index: true`; `unique` already builds the index.
- ⚪ `lib/validation/research.ts:207-223`, the forbidden-price-field `superRefine` is unreachable because the schema is already `.strict()`; keep one mechanism.
- ⚪ `lib/research/http/rateLimit.ts:33-40`, `resetResearchRateLimit()` clears only the in-process map, not the shared store, despite the general name.
- ⚪ `lib/config/research.ts:238-241`, `parseTimeoutMs` has no upper bound and treats an explicit `0` as "use default" rather than "disable"; a very large value can exceed route `maxDuration`.
- ⚪ `lib/research/export/model.ts:108`, `keywords` is always `[]` and the abstract is emitted both as `abstract` and as a section (recorded as deferred in the repair plan).

## Strengths

- The regeneration ↔ canonical-document fix is complete and genuinely tested:
  `buildEditorDocument` rebuilds `editorDocument` (`regenerate.ts:250`),
  `savePaperIfRegenerationOwner` persists it plus token totals
  (`store.ts:289-315`), the e2e fixture now carries `editorDocument`
  (`tests/e2e/research.spec.ts:44`), and unit + Mongo integration regressions
  assert the regenerated text survives.
- Retention is safe-by-construction: the cascade uses the Mongoose models (so
  it cannot drift from the uncountable `paper` collection), the maintenance
  route fails closed without `CRON_SECRET` and uses a length-checked
  `timingSafeEqual` (`route.ts:10-31`), dry-run is supported, and the flow is
  covered by a real-Mongo test.
- Timeout classification is correct: `AbortSignal.timeout` errors are surfaced
  as retryable/fallbackable with a clear message (`client.ts:293-311`), only
  retryable/auth/not-found/network errors fall back (never 4xx client errors),
  and Crossref/OpenAlex now carry 8s timeouts.

## Test coverage

Configured suite (vitest + playwright). I ran the finish-up files directly:
`tests/integration/rate-limit-shared.test.ts`, `tests/integration/research-retention.test.ts`,
`tests/unit/research-model-contract.test.ts`, `tests/unit/editor-export.test.ts`
— 30 tests passed; `tsc --noEmit` exits 0. Coverage of the new logic is
reasonable: shared fixed window + rollover + fail-open, timeout abort + fallback,
regeneration `editorDocument`/token-total persistence, and retention dry-run +
cascade + 401 + authorized run. Gaps: (1) no test drives a generation step
through lease expiry with a concurrent claim (the Major above); (2) discovery
concept-extraction timeout is untested; (3) `recordTokenUsage` delta semantics
are untested; (4) purge scale/pagination is untested; (5) the `x-maintenance-secret`
header path on the purge route is not covered.
