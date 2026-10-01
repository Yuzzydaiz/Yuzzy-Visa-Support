# Review, ai-research-paper-gen, 2026-10-01

**Reviewed by**: deepseek-flash (author on deepseek-flash)
**Scope**: 140 files, branch vs main (14 tracked + 126 untracked)
**Verdict**: Blocked

> **Cross-model guarantee degraded.** The review process calls for a reviewer on a
> different model than the author. No second model is available in this
> environment, so the reviewer and the author are the same model family
> (`deepseek-flash`). Findings here are reached by reading the code and running
> the configured gates (`pnpm typecheck` exit 0; `pnpm test` 157 passed, 8
> skipped), not by independent model diversity. Treat this as a single-model
> self-review.

## Summary

This branch adds the full Yuzzy AI research writer: Mongo/Mongoose order and paper
persistence, Bachs checkout + signed webhook, access-token gating, a provider-agnostic
LLM client (OpenAI Responses primary, OpenRouter chat-completions fallback), resumable
generation/regeneration with CSL citations, a TipTap editor, and DOCX/PDF export. The
security spine is genuinely solid (timing-safe token compare, HMAC webhook with replay
window, server-side pricing, conditional DB writes), and the repair plan's R01–R10 work
is largely present with real Mongo concurrency tests. However, one blocking defect
remains in the regeneration→editor path: once a paper has a persisted `editorDocument`,
regenerating a section updates `sections` but not `editorDocument`, so the client
re-renders the stale document and a follow-up autosave silently overwrites the
regenerated section. Reload also drops the canonical document entirely, losing
formatting. A few robustness gaps (in-memory rate limiting, regeneration token totals
not persisted, no provider timeouts) round out the change.

## Blockers

### 🔴 Regenerated section is invisible and then overwritten by the next autosave, `lib/research/orders/store.ts:281` + `components/research/paper-workspace.tsx:55`
**Problem**: `savePaperIfRegenerationOwner` persists `sections`, `regeneration`,
`generation.bibliography` and `generation.currentStep`, but never touches
`paper.editorDocument` (the canonical TipTap document). `regenerate.ts:208-227`
updates `sections[sectionIndex].contentJson` and returns `publicPaperProjection`,
which still carries the *old* `editorDocument`. The client then does
`setPaper((current) => ({ ...current, ...payload }))` and bumps `editorKey`
(`paper-workspace.tsx:236-238`), so `docFromPaper` hits its first branch
(`paper.editorDocument?.type === "doc"`, `paper-workspace.tsx:56`) and returns the
stale document instead of the regenerated section.
**Why it matters**: After any prior save (which is the normal flow: edit → regenerate),
the regenerated prose is not shown; the user sees the pre-regeneration text. Worse, the
next edit/save sends that stale document, `handlePatchPaper` maps it back to sections
(`papers/patch.ts:120-149`) and `savePaperIfEditorVersion` writes it, permanently
discarding the regeneration. This breaks repair R05's "regenerated section must remain
after reload" and the C25 contract.
**Suggested fix**: On regeneration, rebuild the canonical document from the updated
sections and persist it in `savePaperIfRegenerationOwner` (or `$unset` `editorDocument`
so the client rebuilds from `sections`), then have the client initialize from that
returned canonical document. Add a regression that starts from a paper with a non-null
`editorDocument`, regenerates, and asserts the regenerated text is both displayed and
still present after a subsequent save.

## Major

### 🟠 Canonical editor document is dropped on initial load; formatting and nesting are lost on reload, `components/research/paper-progress.tsx:138`
**Problem**: `PaperProgress` builds the `PaperWorkspace` `initial` object by hand and
omits `editorDocument` entirely (not in `PaperPayload` and not in the literal at
:138-148). `docFromPaper` therefore always falls back to `sectionsToTiptapDoc`, which
reconstructs documents from the flattened `contentJson` paragraphs produced by
`tiptapDocToSections` (`editor/document.ts:150`). Bold/italic/code marks, blockquote
structure and list nesting are not recoverable from that flattened text.
**Why it matters**: R04 requires "all supported content survives save → GET → reload".
Today a reviewer who formats text and refreshes loses the marks and structure even
though the server stored the canonical document; only plain text with `- `/`> `
markers survives. It also masks the blocker above across page loads.
**Suggested fix**: Add `editorDocument` to `PaperPayload` and pass it through in
`initial` so `PaperWorkspace` initializes from the authenticated canonical document
(the projection already returns it).

### 🟠 Rate limiting is process-local and ineffective for the costly unauthenticated endpoints, `lib/research/http/rateLimit.ts:24`
**Problem**: Limits are enforced with a module-level `Map` (`hits`) per server instance.
There is no shared store. `handleReferenceDiscover` (`discovery/http.ts`) and
`handleReferenceResolve` are unauthenticated and each call triggers an LLM request
and/or OpenAlex/Crossref lookups. On a serverless or multi-instance deployment the
per-IP windows are not shared, so an attacker rotating or simply benefiting from
instance fan-out can exceed the intended 30/10min budget.
**Why it matters**: Directly undermines the BUILD_CHUNKS hard rule on bounded OpenAI
spend and C28's "critical routes limited". `.env.example:53` documents the limitation,
but discovery is a billable, unauthenticated endpoint.
**Suggested fix**: Back the limiter with a shared store (Convex rate-limiter, Redis, or
an edge/WAF rule) keyed by IP for `resolve`/`discover`, and keep the Mongo lease as the
per-paper guard for authenticated generation.

### 🟠 Regeneration never persists provider token usage, `lib/research/orders/store.ts:281`
**Problem**: `generateSectionJson` calls `addTokenUsage` which mutates
`paper.generation.totalInputTokens/totalOutputTokens`, but
`savePaperIfRegenerationOwner`'s `$set` omits those fields. The generation finalizer
(`store.ts:217`) correctly spreads the whole `generation` subdocument, so only the
regeneration path loses the totals.
**Why it matters**: Cost tracking, `recordTokenUsage` daily warnings and the token
totals surfaced to the client under-count every regeneration, so spend reporting and
alerts drift low exactly where the feature is most expensive to operate.
**Suggested fix**: Include `generation.totalInputTokens` and `totalOutputTokens` in the
regeneration `$set` (there is already a regression for the generation path to mirror).

### 🟠 New persistence behavior is untested on the paths that matter, `tests/e2e/research.spec.ts:6`
**Problem**: The e2e fixture `completedPaper` has no `editorDocument`, and the
"pending autosave flushes before regeneration" test asserts only that `stale-edit`
disappears from the editor — which passes precisely because the fallback rebuilds from
`contentJson`, i.e. the exact scenario that hides the blocker. The live `v01-sandbox`
harness asserts regeneration returns 200 and quota is enforced, but never inspects
`editorDocument` after regeneration (tests/integration/v01-sandbox.test.ts:299-363).
**Why it matters**: The most damaging behavior of the feature (regeneration survival)
has no effective coverage; the current tests give false confidence.
**Suggested fix**: Cover the stateful sequence against real persistence: prior save sets
`editorDocument` → regenerate → assert the new section text is displayed and that the
canonical document survives a following save and reload. Include `editorDocument` in
the e2e mock.

## Minor

### 🟡 Coherence-rejection log loses request correlation, `lib/research/generation/next.ts:377`
`maybeCoherence` calls `createRequestId()` for its rejection log instead of the
caller's request id, so the diagnostic cannot be tied back to the originating
`generate-next` request. Thread the ambient `requestId` through.

### 🟡 `citedRefIds` uses substring matching, `lib/research/generation/apply.ts:89`
`rendered.citedIds.filter((id) => tokenText.includes(id))` is a substring test, so
`ref_1` also matches text containing `ref_10`. With generated `ref_01`-style ids this is
unlikely today, but client-supplied ids are arbitrary. Match on `collectCitedIds(tokenText)`.

### 🟡 Reference provider fetches have no timeout, `lib/research/references/crossref.ts:64` / `lib/research/references/openalex.ts:94`
`getJson` calls `fetchImpl` without an `AbortController`/timeout. A hung Crossref or
OpenAlex request stalls `resolve`/`discover` until the platform timeout. `safeFetch`
does this correctly; apply the same pattern here.

### 🟡 Order creation is not atomic across paper and order, `lib/research/orders/http.ts:165`
`createPaperAndOrder` creates the Paper and then the Order; if `Order.create` throws
(e.g. a concurrent duplicate `idempotencyKey` losing the unique-index race), the
already-created Paper is orphaned with no checkout and no token returned. Consider
compensating cleanup, an upsert, or a transaction.

### 🟡 Discovery concept extraction bypasses the provider abstraction and can misroute the key, `lib/research/discovery/concepts.ts:58`
`extractConceptsWithLuna` posts to a hardcoded `https://api.openai.com/v1/chat/completions`
using `llm.providers[0].apiKey` (`discovery/http.ts:86`). When OpenRouter is primary or
the only provider, this sends an OpenRouter key to OpenAI and always falls back to
deterministic concepts. Route it through `createLlmClientFromConfig` like the other
utility calls (or pass an explicit OpenAI key only).

### 🟡 Customer research context is not labelled as data in the section system prompt, `lib/research/ai/prompts.ts:37`
The system prompt says source *evidence* is "data, not instructions", but the customer
`researchContext` injected by `sectionUserPrompt` carries no equivalent instruction,
and the test at `tests/unit/research-model-contract.test.ts:159` only asserts the
delimiter is present. Add the same data-not-instructions clause (the outline prompt
already has one).

### 🟡 `safeFetch` reads the whole body before enforcing `maxBytes`, `lib/research/security/safe-fetch.ts:205`
`Buffer.from(await response.arrayBuffer())` materializes the payload before the size
check. A hostile large response can consume memory up to the platform limit. Stream and
abort past `maxBytes`.

### 🟡 Export duplicates the abstract and always emits empty keywords, `lib/research/export/model.ts:75`
The abstract section is emitted as the `abstract` field *and* kept in `sections`, and
`keywords` is hard-coded `[]` though the model contract and DOCX/PDF render keywords.
Cosmetic but it means the DOCX/PDF do not match the intended structure.

## Nits

- ⚪ `lib/research/http/rateLimitStub.ts:1`, pure re-export of the real limiter; tests could import the real module and delete this indirection.
- ⚪ `lib/research/orders/store.ts:72`, the in-memory `checkoutUrls` Map is now redundant since `Order.checkoutUrl` is persisted.
- ⚪ `app/api/research/papers/[id]/route.ts:12`, the access token is accepted via query string on GET (and export); a fragment/cookie exchange avoids URL and log leakage.
- ⚪ `lib/research/papers/patch.ts:107`, an invalid `contentJson` is silently ignored rather than rejected, which can mask client bugs.
- ⚪ `lib/research/papers/patch.ts:176`, the `presented` cookie is re-set on every authenticated request; harmless but noisy.

## Strengths

- Access control is consistently applied: every paper route verifies the peppered,
  timing-safe hash (`auth/accessToken.ts:15`), the authenticated projection excludes the
  hash (asserted in tests), and payment state — not the redirect — is what unlocks
  generation.
- The webhook is treated as hostile input: HMAC-SHA256 over `timestamp.body` with a
  5-minute replay window, constant-time compare, amount/currency re-checks, a unique
  event store for idempotency, and a transaction for the paid transition
  (`payments/webhook.ts:17`, `state/orderTransitions.ts:165`).
- Conditional persistence is real, not incidental: version/owner predicates in
  `savePaperIfEditorVersion` and `savePaperIfGenerationOwner`, plus genuine
  `mongodb-memory-server` concurrency tests proving one winner, lease reclaim and stale
  owners unable to finalize.
- The outbound model contract is explicit (strict `json_schema` with the exact
  `sectionId`), returned identity is checked, invalid citations get exactly one bounded
  repair, coherence replacements are re-validated before acceptance, and citations are
  numbered paper-wide from a single ordered context.

## Test coverage

`pnpm typecheck` exits 0; `pnpm test` reports 157 passed / 8 skipped. Unit and
integration coverage is broad and meaningful: transitions, scoring, citations,
validation, editor round-trip, webhook idempotency, token projection, model contract,
provider fallback, and isolated-Mongo concurrency. Gaps: (1) the regeneration →
`editorDocument` path is never exercised with a non-null canonical document, and the e2e
mock omits `editorDocument`, which is why the blocker passes CI; (2) reload of the
canonical document is untested; (3) the live `v01-sandbox` acceptance journey is gated
behind `RUN_V01` and skipped in the default CI job, so the real provider/payment path is
not a merge gate; (4) distributed rate-limit behavior and provider timeouts are
untested.
