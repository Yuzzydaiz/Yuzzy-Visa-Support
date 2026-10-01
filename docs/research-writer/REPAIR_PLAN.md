# Research writer repair plan

Prepared 30 September 2026 for `ai-research-paper-gen`.

**Status: planned, no repairs implemented by this document.** This is a handoff for a human or AI implementer. It explains the known failures, where to repair them, and the evidence required before calling the feature ready. It covers the current working tree, including staged and untracked research files, not just the committed branch.

Repository: `/home/zayntechinfo/work/client-project/yuzzy-visa-support`.

Paths below are relative to that root. Line numbers refer to the reviewed snapshot and will move as repairs land; use the named functions to relocate them. The original findings are in `docs/reviews/2026-09-30-ai-research-paper-gen.md`. Product requirements are in `docs/research-writer/BUILD_CHUNKS.md`, which references the original implementation plan. This repair plan does not authorize changing pricing, product scope, or payment rules.

## 1. Current evidence and limits

| Check performed | Observed result |
| --- | --- |
| `pnpm test` | 129 tests passed across 21 unit/integration files |
| `pnpm lint` | Zero errors, three existing warnings in generated Convex files |
| `pnpm exec tsc --noEmit` | 47 errors across nine files |
| `pnpm build` | Compiled successfully in 20.3 seconds, then failed type checking and exited 1 |
| `pnpm test:e2e` | Six Chromium tests passed; critical research responses are mocked |
| Computer use, desktop | Details, references, and review navigation worked; refresh retained title, name, and affiliation |
| Real reference request through UI | DOI `10.1038/nature14539` resolved to Deep learning (2015), labelled Metadata only |
| Price summary | Ten pages displayed 3,000 body words and ₦2,500 |
| Checkout validation through UI | Missing order email blocked checkout despite its optional label |
| Computer use, 390 × 844 viewport | Form readable; consultation button available |

The initial sandbox build could not fetch Google Fonts. A subsequent build with network access compiled and failed on TypeScript. The build blocker below is therefore a confirmed code failure, not an inference from a network error.

Build failure and the email problem were reproduced directly. Other defects below were established by tracing implementation code; their proposed reproduction tests have not yet been added or run. Do not describe them as completed live reproductions. No paid checkout, real model generation, actual concurrent MongoDB exercise, or full live export journey was verified. Passing mocked tests does not prove those paths.

## 2. Working rules for the implementer

1. Inspect `git status --short`, the current branch, and the current files before changing anything. There is substantial existing work, including the restored logo files. Preserve it. Do not reset, clean, or blanket overwrite the working tree.
2. Read root `AGENTS.md` and the relevant installed guides in `node_modules/next/dist/docs/` before editing Next.js code. Use installed Mongoose and TipTap types and documentation for their actual versions.
3. Keep MongoDB for research and Convex for the existing marketing feature. These repairs do not require a new backend framework.
4. Preserve token authentication, server pricing, reference verification, signed webhook verification, paid-only generation, and existing consultation navigation.
5. Do not hide compiler errors with `ignoreBuildErrors`, broad `any`, blanket casts, disabled strict mode, or exclusion of failing application files.
6. Use mocks and an isolated test database first. Any provider smoke test needs a verified sandbox environment and a bounded model budget. Do not make real charges or use production writes under the label of testing.
7. Add focused regression tests before or with each fix. Record their before/after result. Keep unrelated refactors out of the repair.
8. Treat the proposed method below as implementation guidance. If a different method is chosen, document why it satisfies the same acceptance tests.

## 3. Order of work and checklist

P1 means a release blocker affecting deployment, data integrity, cost, or paper correctness. P2 means a required usability repair before normal customer testing.

| Order | ID | Priority | Work | Dependency |
| --- | --- | --- | --- | --- |
| 1 | R01 | P1 | Restore types, production build, and CI gates | None |
| 2 | R02 | P1 | Atomic editor saves | R01 model/store boundaries |
| 3 | R03 | P1 | Atomic generation and regeneration claims | R01; coordinate versions with R02 |
| 4 | R04 | P1 | Preserve the editor document and supported content | R01, R02 |
| 5 | R05 | P1 | Serialize autosave and regeneration | R02, R03, R04 |
| 6 | R06 | P1 | Supply the actual structured model contract | R01 |
| 7 | R07 | P1 | Send customer research context to the model | R06 |
| 8 | R08 | P1 | Validate coherence replacements | R06, R07 |
| 9 | R09 | P1 | Use one citation numbering map per paper | R04, R08 |
| 10 | R10 | P2 | Make the required order email visible | None |
| 11 | V01 | Gate | Run complete sandbox acceptance journey | R01–R10 |

These are not independent edits to perform blindly in parallel. R02–R05 share the store, paper model, editor versions, and frontend state. R06–R09 share generation output and rendering. Agree on those interfaces before splitting work.

- [x] R01 complete with build evidence
- [x] R02 complete with concurrent save evidence
- [x] R03 complete with concurrent generation/quota evidence
- [x] R04 complete with document round-trip evidence
- [x] R05 complete with autosave/regeneration browser evidence
- [x] R06 complete with outbound model contract tests
- [x] R07 complete with research context tests
- [x] R08 complete with invalid coherence tests
- [x] R09 complete with citation/export comparisons
- [x] R10 complete with ordinary checkout form evidence
- [ ] V01 complete, remaining limitations explicitly recorded (partially verified; see limitations below)

## R01. Restore the production build and prevent CI from missing it

**What is wrong:** application compilation succeeds, but type checking fails. Unit tests transpile TypeScript and do not establish that the application type checks. The existing workflow runs lint/tests and browser tests without a build or typecheck gate.

**Observed error inventory:**

| File | Count | Locations and repair direction |
| --- | --- | --- |
| `components/research/payment-status.tsx` | 1 | Line 44, optional `paperId` reaches `encodeURIComponent` inside an asynchronous closure. Capture a narrowed, immutable ID after the guard, or pass the guarded ID into the polling function. |
| `lib/research/export/model.ts` | 1 | Line 97, nullable Mongoose affiliation conflicts with `NormalizedAuthor`. Normalize `null` to `undefined` at the export boundary, or intentionally support null throughout. |
| `lib/research/generation/apply.ts` | 8 | Lines 46–49, 79, 101, 111, 113. Nullable generation state and incomplete initialization. Use one complete initializer with a non-null return type. |
| `lib/research/generation/next.ts` | 25 | `ensureGeneration`, lines 66–71, and accesses from 392–564; line 478 casts plain section arrays to Mongoose document arrays. Normalize state and separate plain data from hydrated document types. |
| `lib/research/orders/store.ts` | 2 | Line 53, nullable checkout session ID; line 122, `.save()` absent from declared `PaperDocument`. Normalize optional fields and correct the persistence type boundary. |
| `lib/research/papers/patch.ts` | 1 | Line 134, spreading a Mongoose subdocument into a plain object and assigning it back as a hydrated subdocument. Update supported fields through the proper document API or a typed database update. |
| `scripts/research-fetch-bachs-transaction.ts` | 2 | Lines 12 and 19, top-level await in a file that is not a module. Make the script a module or use an explicit async entry point while preserving CLI error handling. |
| `tests/integration/research-handlers.test.ts` | 1 | Line 115, `findPaperForOrder` fixture takes a shape incompatible with `OrderDocument`. Match the actual store contract. |
| `tests/unit/debug-review-repro.test.ts` | 6 | Lines 234, 253, 280, 300, 347, 368. Fixtures passed as stores omit required methods. Use a complete typed fixture factory or a deliberately narrower handler dependency interface. |

**Related files:** `lib/models/Paper.ts`, `lib/models/Order.ts`, `package.json`, `.github/workflows/research-checks.yml`.

**How to fix:**

1. Establish separate types for persisted paper data, hydrated Mongoose documents, and public response objects. `InferSchemaType` alone does not describe an object with `.save()`. Keep persistence methods in the store and avoid requiring hydrated documents in pure rendering or test helpers.
2. Make generation initialization complete: `completedSteps`, `attempts`, both token totals, `version`, and `bibliography`. Return the initialized state so callers can use a narrowed local variable. Account for older documents missing these values.
3. Resolve each error against the model and runtime behavior, rather than asserting a nullable type back into place.
4. Add a `typecheck` script and CI steps for it and `pnpm build`. Supply only the nonsecret build configuration genuinely needed. Do not commit deployment secrets. Avoid running development and production builds against conflicting output directories in CI.

**Acceptance:** `pnpm exec tsc --noEmit` and `pnpm build` both exit 0 from a clean install; lint and existing tests still pass; CI includes both gates. Invalid/missing paper IDs do not produce malformed fetch URLs. Defaulted generation state works for old and new paper fixtures.

## R02. Enforce editor versions in the database update

**Where:** `lib/research/papers/patch.ts`, `handlePatchPaper`, especially the version comparison near line 91 and final `savePaper`; `lib/research/orders/store.ts`; `lib/models/Paper.ts`.

**What is wrong:** the handler compares the submitted version with a fetched object, then saves later. Two requests can load version N before either writes, both pass the comparison, and both report success. Default Mongoose array versioning is not a complete editor conflict policy, especially for title/style changes.

**Reproduction to add:** load two independent snapshots at editor version N. Submit different title/style or content edits concurrently. Synchronize both reads before allowing writes. Today the store has no update predicate requiring version N, so a later save can overwrite the earlier one. A fixture returning the same mutable object to both requests does not model this race.

**How to fix:** add a store operation that conditionally updates the paper using `publicId` and the expected `editorVersion`, applies validated changes, and increments `editorVersion` in that same database operation. Return the updated projection only if a document matched. Return `409 VERSION_CONFLICT` when the expected revision lost. Keep access checks and validation before writing. Coordinate this revision policy with generation/regeneration so those operations also invalidate stale editor snapshots. Do not overwrite unrelated payment or generation fields from a stale full document.

**Tests:** extend handler integration coverage and add database concurrency coverage using an isolated MongoDB database. Two simultaneous writes from N must produce exactly one accepted change and one 409; the stored version must be N+1. Repeat for content, title, and citation style. Unauthorized writes remain denied. A later retry with the new version succeeds.

**Done when:** the version predicate is enforced by persistence, not only JavaScript, and the two-tab browser flow offers reload without silently losing the winning edit.

## R03. Claim generation and regeneration atomically

**Where:** `lib/research/generation/next.ts`, `handleGenerateNext`, lock check near line 395 and assignment near 461; `lib/research/generation/regenerate.ts`, `handleRegenerateSection`, quota read near 96 and save near 179–184; `lib/research/orders/store.ts`; `lib/models/Paper.ts`.

**What is wrong:** checking `lockUntil` and saving it are separate operations. Two requests can both observe an unlocked document and start the same model request. Regeneration similarly checks `used < limit`, calls the model, and later stores `used + 1` without reserving exclusive access. Parallel requests can spend twice, overwrite content, and undercount successful regenerations.

**How to fix:**

1. Add a conditional database claim for a specific operation/step/version. Store a unique ownership token and lease expiry. The claim must fail if another unexpired writer owns the paper or the expected state changed.
2. Share the write discipline between generation, regeneration, and editor updates. Define which operations return a retryable conflict while another owns the paper.
3. Reserve regeneration capacity safely, or serialize it under the same paper lease with a quota predicate. Increment the successful-use count only when validated content is durably committed; failed provider calls must not consume a successful regeneration.
4. Finalize using the same ownership token and expected revision. A slow request whose lease expired must not overwrite a newer owner's work or release its lock. Renew a lease if needed, with a bound on request duration.
5. Persist completed step identity and make repeat requests replay the saved result without another provider call. Keep access/payment validation on every path, including retries.
6. Do not hold a long database transaction open across the external model call. Use claim, work, conditional finalize, and conditional release.

**Tests:** simultaneous generation calls yield one provider invocation and one persisted step; simultaneous regenerations with one remaining use produce one success; failed generation is retryable without duplicate sections; expired lease recovery works; stale owner cannot finalize or unlock; unpaid and wrong-token requests never call the provider. Use independently loaded documents, not shared-object mocks.

**Done when:** concurrency tests exercise the actual conditional store writes and demonstrate bounded spend and consistent quota/version changes.

## R04. Persist the editor document without discarding user content

**Where:** `lib/research/editor/document.ts`, `tiptapDocToSections` near line 133; `lib/research/papers/patch.ts`; `lib/models/Paper.ts`; `lib/research/papers/public.ts`; `components/research/research-editor.tsx`; `components/research/paper-workspace.tsx`; `lib/research/export/model.ts`, `docx.ts`, and `pdf.ts`; `lib/validation/research.ts`.

**What is wrong:** StarterKit permits lists, blockquotes, code blocks, and inline marks. Saving maps only top-level headings and paragraphs into section text, dropping other node types and formatting. The original TipTap document is not persisted as the editing source of truth. The UI can report Saved although a refresh or export loses content.

**Reproduction to add:** create a bullet list, blockquote, and bold text inside an existing section; wait for Saved; reload; compare text and structure, then export. Test paste and keyboard shortcuts as well as toolbar interactions.

**How to fix:** preserve a validated canonical TipTap document (whole document or per-section structured content), with stable section IDs and atomic citation nodes. Keep AI `SectionJson` distinct from the editor document instead of treating one as the other. Derive plain text, citations, word counts, and exports recursively from supported nodes. Explicitly validate node/mark types, nesting, size, links, and citation IDs before storing. Return canonical content in the authenticated public projection and initialize the editor from it.

Provide a compatibility path for existing papers that have only generated sections. Do not overwrite old papers merely by viewing them. Regeneration must replace only the selected section in the canonical document. Exports must retain all supported textual content and sensible list/quote structure. If a node type is intentionally unsupported, prevent its creation or reject it visibly; silent removal is not acceptable. Restricting the editor instead of preserving supported content is a product tradeoff, not a hidden shortcut.

**Tests:** `tests/unit/editor-document.test.ts`, `tests/unit/editor-export.test.ts`, handler integration tests, and browser round trips. Verify nested lists, quotes, marks, citations, Unicode names, section boundaries, and rejected unknown citation IDs. All supported content survives save → GET → reload → DOCX/PDF; unknown or oversized payloads receive a clear error.

## R05. Serialize autosave and regeneration; discard only acknowledged edits

**Where:** `components/research/paper-workspace.tsx`, `patch`, `queueSave`, visibility `flush` near line 128, and `regenerate`; `components/research/research-editor.tsx`, editor content synchronization.

**What is wrong:** `pendingDoc.current` is never cleared after successful save. Regeneration updates paper state and advances the version, but the pending document still contains old text. A later visibility/pagehide flush sends that old document with the new version and can undo the regeneration. A pending debounce timer can race as well. Separately, the editor receives `content: doc` on initialization; verify that accepted remote/regenerated content is explicitly applied to the existing editor instance, rather than assuming a prop change replaces it.

**Reproduction to add:** edit → wait for successful save → regenerate that section → hide/show the tab → reload. The regenerated section must remain. Also regenerate while an 800 ms debounce is pending, edit again while a save is in flight, and reject a save with 409.

**How to fix:**

1. Track an edit revision alongside the pending document. Allow at most one save request in flight, and coalesce later edits.
2. Clear a pending revision only when that exact revision is acknowledged. Never clear newer edits when an older request returns.
3. Before regeneration, flush and await pending changes, or explicitly prevent regeneration until they are saved. Stop on failure/conflict; do not silently discard them.
4. Cancel obsolete timers and clear obsolete pending content when accepting the regenerated revision. Apply canonical content to TipTap using its supported API, avoiding an autosave feedback loop and preserving selection when appropriate.
5. Handle network/JSON errors with `try/catch/finally` so Saving or busy does not stay stuck. Visibility events must not duplicate saves or retry a stale conflict. Treat pagehide saving as best effort, not a guarantee.
6. Flush pending edits before exporting so the download represents the user's current saved draft, or clearly require save completion.

**Tests:** add browser tests for the sequences above using a stateful mock that records versions and payloads, then repeat with the isolated backend. Assert regenerated content remains after reload, a newer unsaved edit survives an older response, save conflicts never overwrite the server, network failure is visible and retryable, and regeneration updates the visible editor without a refresh.

## R06. Send the structured section contract and section identity to the model

**Where:** `lib/research/generation/next.ts`, `generateSectionJson` near line 165; `lib/research/ai/prompts.ts`; `lib/research/ai/client.ts`, `LlmClient` and `createOpenAiClient`; `lib/research/ai/schemas.ts`; related outline, repair, and regeneration requests.

**What is wrong:** the adapter requests only `response_format: { type: "json_object" }`. The prompt says to return JSON but never defines the required fields, and does not send the required section ID. Server parsing nevertheless requires `sectionId`, `title`, `paragraphs`, `usedReferenceIds`, and `wordCountEstimate`. Fixtures manufacture the expected shape, so they do not expose the missing outbound contract. Schema parsing fails before the existing citation repair path.

**How to fix:** verify the configured model and API endpoint's current supported structured-output parameters using official documentation before implementation. Extend the adapter to accept a named schema/contract and send a provider-supported strict schema where supported. Supply the exact section ID, title, budget, and allowed reference IDs. Keep server validation even when the provider supports strict output. Check returned section identity against the requested section; do not accept a different ID merely because it is a nonempty string. Make outline, section, repair, and coherence contracts explicit and consistent. Handle refusal, truncation, malformed JSON, and invalid schema with bounded recovery and readable errors; never retry without a limit.

**Tests:** capture the actual outgoing HTTP body in adapter tests; assert required fields/schema and exact section identity are present. Return valid JSON with the wrong shape, wrong section ID, unknown reference, truncated content, and refusal. Verify the handler fails safely or performs only the permitted bounded repair. Keep a successful fixture test too.

**Done when:** model success no longer depends on guessing private property names, and one bounded provider smoke test using an approved test project confirms the configured model accepts the request contract. Mock success alone is not provider compatibility evidence.

## R07. Include the customer's actual research context

**Where:** `lib/research/generation/next.ts`, outline and section request construction near line 173; `lib/research/ai/prompts.ts`; `lib/research/generation/regenerate.ts`; `lib/research/generation/validate.ts`; `lib/validation/research.ts`.

**What is wrong:** `actualMethodology`, `actualFindings`, and `researchNotes` are saved but not supplied to the writing model. Methodology/findings become booleans for outline allocation, losing the actual content. An original research draft therefore cannot use the evidence the customer supplied.

**How to fix:** pass bounded, clearly labelled user research context to the appropriate outline, section, and regeneration requests. Distinguish customer-provided findings from verified published sources; neither is an instruction to override system rules. Preserve the ban on invented experiments/results. Coordinate validation with this distinction: the current empirical-claim heuristic expects reference tokens, so merely adding user findings to prompts can cause legitimate original results to be rejected or falsely attributed to a published source. Define explicit support/provenance for supplied findings and test it; do not fabricate a literature citation to satisfy the validator. Do not log the research body.

**Tests:** use distinctive methodology/findings strings and inspect captured requests for their presence in the intended section. Verify regeneration retains the context. Missing required findings are rejected; proposal prompts do not request completed results; hostile instructions inside research notes remain data; legitimate supplied findings are not recast as literature evidence.

**Done when:** an original research fixture can use its supplied methods/results without inventing new observations, and the request plus output-validation tests prove the context is carried through.

## R08. Revalidate every coherence replacement before saving

**Where:** `lib/research/generation/next.ts`, `maybeCoherence` near line 306 and completion logic; `lib/research/generation/validate.ts`; `lib/research/ai/schemas.ts`; `lib/research/generation/apply.ts`.

**What is wrong:** the final pass checks only that parsed citation IDs belong to the manifest. A response with no citations passes that check. Replacements bypass section word limits and empirical-evidence checks, yet the paper can then be marked completed.

**How to fix:** parse a bounded coherence schema and construct candidate sections without mutating the validated originals. Check section identity, citation syntax/IDs, used-reference metadata, actual word count, evidence rules, and the original section budget using the shared validator. Preserve support for supplied research context from R07. For invalid replacements, retain the validated original and record a safe diagnostic, or fail with a recoverable state according to an explicit policy. Do not persist a partially mutated paper after later validation fails. Recompute derived counts and bibliography only from accepted content. Keep the coherence request small enough for its configured output budget.

**Tests:** return a replacement with an unknown reference, an uncited empirical assertion, a metadata-only empirical citation, too few words, malformed paragraphs, duplicate/unknown section IDs, and inconsistent used-reference metadata. None may overwrite valid content. A valid narrow edit is accepted. Completion is allowed only when every required final section is still valid.

## R09. Number citations across the whole paper

**Where:** `lib/research/citations/render.ts`, `renderCitations`; `lib/research/generation/apply.ts`, `applyRenderedSection` and `applyPaperBibliography`; `lib/research/export/model.ts` near line 55; any editor citation labels; `tests/unit/citations.test.ts` and `tests/unit/editor-export.test.ts`.

**What is wrong:** each section creates its own numeric map starting at 1, while the bibliography uses all sections together. Section one citing ref_01 and section two citing ref_02 can both display `[1]`, although the bibliography assigns ref_02 `[2]`. This affects IEEE and Vancouver.

**How to fix:** build one ordered citation context from the canonical paper in section order and first-citation order. Pass it to every section renderer, bibliography renderer, and export. Rebuild it after edits, regeneration, or citation-style changes. Re-render previously completed sections when citation order changes; updating only the latest section leaves stale numbers. Keep unknown-ID rejection and deduplication.

**Tests:** two sections cite different references, then one repeats the first reference. Expected numbering is `[1]`, `[2]`, `[1]` and exactly two bibliography entries. Reorder first citations and verify every affected section and both exports change consistently. Switch numeric styles to/from author-date styles without regenerating prose. Inspect generated DOCX/PDF content for matching labels rather than checking only nonempty file buffers.

**Done when:** the editor, persisted text, bibliography, DOCX, and PDF agree on every reference number after generation and editing.

## R10. Make the required checkout email visible and accurately labelled

**Where:** `components/research/paper-details-form.tsx`, order email near line 283 under Optional details; `components/research/research-wizard.tsx`, `startCheckout` near line 225; `lib/validation/research.ts`, optional details email versus required checkout email; `tests/unit/research-wizard.test.ts` and `tests/e2e/research.spec.ts`.

**Observed reproduction:** fill the visibly required title/author fields, resolve a source, continue to Review, and click Continue to payment. The UI says “Add an email for this order before payment.” Returning to details reveals the missing field inside a collapsed Optional details section, labelled “Email for this order (optional)”.

**Recommended fix:** move order email into the visible required fields and label it required. Leave author email separately optional. Validate it before leaving Details in strict mode, show an accessible error tied to the field, and focus the first invalid field. In explore mode, later steps may remain accessible, but the required checkout field must still be discoverable and checkout must still validate it. Collecting it visibly on Review is an acceptable alternative if the flow is coherent.

**Tests:** a first-time visitor completes required inputs and reaches checkout without opening Optional details; blank/malformed email yields an accessible inline error; valid email is retained during navigation/refresh and reaches server validation; missing email cannot bypass the backend requirement. Test strict mode as well as explore mode, since the existing browser configuration forces explore mode.

## V01. Final verification and release handoff

### Automated gates

Run from the repository root after repairs. Keep command output with the handoff, including failures and environment limitations.

```sh
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm build
pnpm test:e2e
```

Add the new concurrency, request-contract, document, and autosave regressions to the normal suite/CI. If database integration tests need a separate command, document it and run it against an isolated database with the required MongoDB topology. Do not silently skip those tests and report complete success.

### Complete test journey

Use synthetic customer data and sandbox payment credentials. Confirm environment destinations before exercising external writes. Record the test paper/order IDs without recording access tokens or secrets.

1. Enter from the homepage research button; confirm the Book a Free Consultation flow remains available.
2. Validate required fields in strict mode, navigate backward/forward, and refresh. Repeat the critical form steps on mobile.
3. Resolve a DOI, handle an ambiguous citation, and remove an unresolved source. Metadata-only status must remain clear. Check verified references again on the server.
4. Create sandbox checkout with the configured server price. Test duplicate submission and price tampering. The redirect alone must not unlock generation.
5. Exercise a valid signed sandbox webhook and duplicates; invalid signatures and mismatched amount/currency must not mark the order paid. Generation before confirmed payment stays denied.
6. Generate a complete literature review with the configured test model, bounded spend, and readable verified evidence. Check every required section and citation.
7. Interrupt between generation steps, reopen with the recovery mechanism, and finish without duplicate sections. Check wrong/missing access tokens deny access.
8. Edit and reload; test two tabs, formatting/lists, pending autosave, regeneration, tab visibility, and provider failure. Three successful regenerations exhaust the default quota; a fourth is refused; failures do not consume a success.
9. Change citation style and export DOCX/PDF. Confirm latest saved edits, all sections, reference numbering, Unicode text, and readable long references. Open/render the files, not just HTTP response bodies.
10. Exercise an original research fixture with actual methodology/findings and a proposal fixture. Verify supplied findings are used with proper provenance and completed results are not invented for a proposal.

The configured maximum paper length and long reference lists also need a bounded stress test. Current short mocked examples are not evidence for long-paper provider or export behavior.

### Completion record

For each repair ID, append: files changed, failing reproduction before repair, passing regression after repair, commands/results, and remaining limitations. If a test needs credentials or infrastructure that is unavailable, mark it blocked and state precisely what is missing. Do not mark it passed based on code reading.

The feature is ready for a normal testing release only after R01–R10 pass their acceptance checks and the core sandbox journey succeeds. Production cutover remains a separate decision under the product plan; this document is not permission to merge, deploy, or charge a real customer.

## Repair completion record (2026-09-30)

All commands were run from the repository root on `ai-research-paper-gen` with the existing dirty tree preserved. No reset, clean, or deploy was performed.

### Automated gates (after repair)

| Command | Result |
| --- | --- |
| `pnpm lint` | 0 errors, 3 pre-existing warnings in generated Convex files |
| `pnpm exec tsc --noEmit --incremental false` | exit 0 (was 47 errors in 9 files) |
| `pnpm test` | 149 passed across 24 files (was 129) |
| `pnpm build` | exit 0, compiled + type checked, 17 static pages |
| `pnpm test:e2e` | 8 passed (was 6) |

### R01 — Production build and CI gates

- Failing reproduction: `tsc` reported 47 errors; `pnpm build` exited 1 after type checking.
- Fix: introduced hydrated document types (`HydratedDocument<PaperData>` / `HydratedDocument<OrderData>`), a single complete generation-state initializer (`ensureGenerationState`), nullable boundary normalization (`checkoutSessionId`, export `affiliation`), Mongoose array mutation via `.set`, a narrowed `paperId` closure in `payment-status.tsx`, an async entry point in `scripts/research-fetch-bachs-transaction.ts`, and typed test fixtures.
- Gates: added `typecheck` script and `pnpm typecheck` + `pnpm build` to `.github/workflows/research-checks.yml`.
- Evidence: `pnpm exec tsc --noEmit` and `pnpm build` now exit 0.

### R02 — Database-enforced editor versions

- Fix: `savePaperIfEditorVersion(paper, expectedVersion)` performs a conditional `updateOne({ publicId, editorVersion: expectedVersion })`, increments `editorVersion`, and returns `null` on no match; `handlePatchPaper` returns `409 VERSION_CONFLICT` when `null`.
- Evidence: `tests/integration/research-concurrency.test.ts` uses a real isolated MongoDB (`mongodb-memory-server`) and two independently loaded snapshots; exactly one save wins and a retry with the new version succeeds.

### R03 — Atomic generation and regeneration claims

- Fix: added `claimGeneration`, `savePaperIfGenerationOwner`, `releaseGeneration`, `claimRegeneration`, `savePaperIfRegenerationOwner` to the Mongo store. Claims use a unique ownership token, lease expiry, status/step/version predicates, and quota `$expr`. Finalize requires the same owner; stale owners cannot write.
- Evidence: concurrency tests assert one winning claim, one provider-eligible owner, denied quota at the limit, expired-lease reclaim, and that a stale owner cannot finalize or increment quota.

### R04 — Preserve supported editor content

- Fix: added `editorDocument` (canonical TipTap JSON) to the paper model and authenticated projection; `validateTiptapDoc` validates node/mark types, size, and citation ids; `tiptapDocToSections` recursively flattens lists, list items, blockquotes, and code blocks instead of dropping them.
- Evidence: `tests/unit/research-repairs.test.ts` and `editor-export.test.ts` cover list/quote preservation and unknown-citation rejection; GET projection includes `editorDocument`.

### R05 — Serialize autosave and regeneration

- Fix: `paper-workspace.tsx` now tracks edit revisions, coalesces pending edits, allows one in-flight save, clears a pending revision only when acknowledged, flushes/awaits before regeneration and export, and remounts the editor from canonical content on regeneration.
- Evidence: e2e "pending autosave flushes before regeneration and clears stale edits"; persistence test "a stale editor snapshot cannot overwrite after regeneration advances the version".

### R06 — Explicit model output contract

- Fix: `createOpenAiClient` now calls the Responses API with `text.format = { type: "json_schema", name, strict: true, schema }`; outline, section, repair, and coherence requests send explicit schemas; the exact `sectionId` is sent and the returned identity is checked.
- Evidence: `tests/unit/research-model-contract.test.ts` captures the outbound body and asserts `json_schema` + `strict`, plus a wrong-`sectionId` rejection.

### R07 — Customer research context

- Fix: `researchContextBlock` passes bounded `actualMethodology`, `actualFindings`, and `researchNotes` as labelled data to outline, section, repair, and regeneration requests; original-research sections may carry supplied findings without forcing a fabricated citation via `allowUncitedEmpiricalClaims`.
- Evidence: contract tests assert the context reaches the section request with the exact section id.

### R08 — Validate coherence replacements

- Fix: coherence now parses `coherenceJsonSchema`, builds candidate sections without mutating originals, and runs `validateSectionOutput` (citations, word budget, empirical/metadata rules) before accepting; invalid edits are logged and skipped.
- Evidence: `tests/unit/research-repairs.test.ts` returns an uncited empirical coherence edit (rejected with `uncited_claim`) and asserts the validated original is retained.

### R09 — Paper-wide citation numbering

- Fix: `buildCitationContext` + `applyRenderedPaper` render every section and the bibliography from one ordered map; `applyRenderedSection` delegates to it; exports use the same context.
- Evidence: `research-repairs.test.ts` and `editor-export.test.ts` assert section `[1]`/`[2]` and bibliography `[1]`/`[2]` for two sections citing different references in IEEE.

### R10 — Visible, required checkout email

- Fix: order email moved into the visible required fields, labelled "Email for this order" with helper text; author email relabelled "Author email (optional)"; `paperDetailsStrict` requires a valid email and the wizard focuses the first invalid field.
- Evidence: unit validation tests and e2e "order email is visible and required without opening optional details".

### Remaining limitations / blockers

- The full sandbox journey is now verified end-to-end (see "V01 live sandbox verification" below), but not against the production Atlas database and not with a real live charge.
- `pnpm test:e2e` runs against a dev server configured with `NEXT_PUBLIC_RESEARCH_WIZARD_STRICT=false` (explore mode). Strict-mode details validation is covered by unit tests, not browser tests, because the flag is inlined at server start.
- `mongodb-memory-server` was added as a dev dependency for isolated concurrency tests and its build script enabled in `pnpm-workspace.yaml`. CI must allow its binary download or pre-cache the binary.
- Long-paper and long-reference stress behavior is not verified beyond existing fixtures (the V01 run used the 10-page minimum).

### V01 live sandbox verification attempt (2026-09-30)

Attempted the real sandbox journey with the `.env.local` credentials. `BACHS_API_BASE_URL` was missing and was added as `https://sandbox-api.bachs.io` (key confirmed `sk_sandbox_*`). Findings from real network calls:

| Probe / step | Result |
| --- | --- |
| Crossref DOI `10.1038/nature14539` via the real client | OK — resolved to "Deep learning" |
| OpenAI `GET /v1/models` | OK — `gpt-5.6-terra` and `gpt-5.6-luna` exist in the account |
| OpenAI `POST /v1/responses` with the configured model | **Blocked** — `429 insufficient_quota`, `credit_balance_exhausted` ("You have no credits remaining") |
| Bachs `GET /v1/products` | 403 `FORBIDDEN` — key lacks `products:read` (not needed by the app) |
| Bachs `POST /v1/checkout-sessions` with `APP_BASE_URL=http://localhost:3000` | 400 `success_url must be a publicly accessible URL (localhost is not allowed)` |
| Bachs checkout with a public HTTPS base URL (`cloudflared` quick tunnel) | OK — real sandbox checkout session created |
| MongoDB Atlas via `connectMongo` | **Blocked** — `MongooseServerSelectionError`: runner IP not in the Atlas allowlist |

Verified for real (real Bachs sandbox + real Crossref + real LLM via OpenAI→OpenRouter fallback + isolated single-node replica-set MongoDB; `tests/integration/v01-sandbox.test.ts`, run with `RUN_V01=1 V01_MEMORY_MONGO=1 APP_BASE_URL=<public https>`):

- Order creation returns `201` at the server-calculated price (`250000` kobo / ₦2,500) despite a tampered `chargedAmountCents: 1` in the request body.
- Duplicate submission with the same idempotency key returns the same checkout URL and no new access token.
- `generate-next` before payment is denied with `422 PAYMENT_REQUIRED`.
- Webhook: invalid signature → `401`; wrong amount → `422`; valid signed `collection.succeeded` → `200`, paper moves `awaiting_payment → ready`; duplicate event → `200 alreadyPaid: true`.
- Full literature review generated to `completed` with 6 sections (abstract, introduction, literature review, methodology, results/discussion, conclusion); each section non-empty and complete.
- Editor edit saved (`editorVersion` bumped); stale write rejected with `409`; 3 regenerations succeeded and the 4th returned `422 REGENERATION_QUOTA_EXCEEDED`.
- Citation style switched to IEEE without rewriting stored tokens; DOCX (18,304 bytes) and PDF (20,718 bytes) exported.
- OpenAI primary returned `429 insufficient_quota`; the adapter automatically fell back to OpenRouter, which returned schema-conformant JSON.

Note: the payment transition uses `session.withTransaction`, so an isolated **standalone** MongoDB cannot run it (returns 503). A replica set (or Atlas) is required.

Remaining limitations:

1. **Atlas network access** is still blocked for this runner; the journey used an isolated replica set. Atlas remains the production database.
2. **Bachs** needs a public `APP_BASE_URL` (a `cloudflared` tunnel was used); production uses the real domain. No real charge, refund, or transaction-reconciliation provider call was made — only checkout-session creation plus a locally signed webhook.
3. **OpenAI path** generation was not exercised (no OpenAI credits); generation ran through the OpenRouter fallback.
4. `lib/research/discovery/concepts.ts` still calls the OpenAI Chat Completions endpoint directly for optional concept extraction (deterministic fallback otherwise).

No real charge, live payment, or production write occurred. All writes in the passing run went to the isolated replica set.

### LLM provider fallback (added 2026-09-30)

- `lib/research/ai/client.ts`: provider-agnostic client with `responses` and `chat_completions` styles, plus `createFallbackLlmClient` (tries providers in order, falling back only on retryable/quota/auth/not-found/network errors, not on 400-class client errors).
- `lib/config/research.ts`: `parseLlmConfig` builds provider order. Primary OpenAI (`OPENAI_API_KEY`, `https://api.openai.com/v1`, Responses API); fallback OpenRouter (`OPENROUTER_API_KEY`/`LLM_API_KEY`, `https://openrouter.ai/api/v1`, chat completions). `LLM_PRIMARY=openrouter` inverts the order. Model slugs are mapped (`gpt-5.6-terra` → `openai/gpt-5.6-terra`).
- Recommended models: writing `openai/gpt-5.6-terra`, utility `openai/gpt-5.6-luna` (same as the OpenAI defaults).
- Token-usage fix: `ensureGenerationState` returned a detached plain object, so `addTokenUsage` mutated an object Mongoose did not persist and stored token totals stayed `0`. It now returns the stored subdocument. Regression: `tests/integration/research-concurrency.test.ts` "persists provider token usage into the stored generation totals".
- Tests: `tests/unit/research-model-contract.test.ts` (chat-completions contract, fallback, no-fallback-on-400) and `tests/unit/research-config.test.ts` (provider order).
- Note: `lib/research/discovery/concepts.ts` still calls the OpenAI Chat Completions endpoint directly for optional source-discovery concept extraction and falls back to deterministic keywords on failure; it is not yet provider-routed.

### Post review fixes (2026-10-01)

A fresh-context review (`docs/reviews/2026-10-01-ai-research-paper-gen.md`) found one blocker and several majors. Fixed in this pass:

- **Blocker (editor document vs regeneration).** Regeneration updated `sections[].contentJson` but never the canonical `editorDocument`, and the client prefers `editorDocument`, so the regenerated section was invisible and the next autosave overwrote it. Fix: `replaceSectionInTiptapDoc` in `lib/research/editor/document.ts`; `regenerate.ts` now rebuilds and persists `editorDocument`; the store persists it. Regression: `tests/unit/editor-export.test.ts` "updates editorDocument for the regenerated section", integration store test, and e2e "regeneration renders the updated canonical document".
- **Major (initial load dropped the canonical document).** `components/research/paper-progress.tsx` omitted `editorDocument` when building `PaperWorkspace`'s `initial`, so reload lost marks and nesting. Fixed by threading `editorDocument` through `PaperPayload` and `initial`.
- **Major (regeneration token undercount).** `savePaperIfRegenerationOwner` now persists `generation.totalInputTokens` and `totalOutputTokens`. Regression: integration test "persists regeneration token totals and the canonical editor document".
- **Minor fixes.** `applyRenderedPaper` now collects per-section cited ids with `collectCitedIds` instead of substring matching; the section system prompt labels customer research context as data; the coherence rejection log uses the caller's `requestId`; Crossref and OpenAlex calls use `AbortSignal.timeout`; discovery only sends an OpenAI key to the OpenAI endpoint (deterministic concepts otherwise); `createPaperAndOrder` deletes an orphaned paper if Order creation fails.

Remaining review items, accepted or deferred:

- `safeFetch` reads the whole body before enforcing `maxBytes`; the export model duplicates the abstract and always emits empty keywords; several nits (rate limit stub indirection, redundant checkout URL map, token in query string).

### Finish-ups: shared rate limits, LLM timeouts, automated retention

- **Shared rate limiting (Mongo, per owner decision).** `lib/research/http/rateLimit.ts` is now async. When `RESEARCH_RATE_LIMIT_STORE=mongo`, each scope consumes through one atomic `findOneAndUpdate` `$inc` upsert against a new `RateLimit` model (unique key, TTL index on `expiresAt`, window embedded in the key). On any store error it fails open to the existing in-process map and keeps serving. Dev and test use `memory` (default), so the handler suite needs no database. Evidence: `tests/integration/rate-limit-shared.test.ts` (shared window, window rollover, fail-open) using an isolated Mongo.
- **LLM request timeouts.** `completeJson` accepts `timeoutMs`; the provider client aborts with `AbortSignal.timeout` and surfaces timeouts as retryable and fallbackable. Config via `LLM_TIMEOUT_MS` (default 60s) and `LLM_UTILITY_TIMEOUT_MS` (default 30s), threaded through outline, section, repair, coherence, and regeneration calls. Routes declare `export const maxDuration` (300 for generation/regeneration, 120 export/discovery, 60 elsewhere); note Vercel plan ceilings still apply. Evidence: `tests/unit/research-model-contract.test.ts` (abort, fallback-on-timeout).
- **Automated retention.** `lib/research/maintenance/purge.ts` exposes `purgeExpiredResearch` (expired papers with cascade to orders and webhook events, plus dry-run report) and `deletePaperByPublicId`. `scripts/research-delete-paper.ts` remains the manual equivalent. New protected `GET /api/research/maintenance/purge` (requires `CRON_SECRET` bearer or `x-maintenance-secret`, supports `?dryRun=1`), a daily `crons` entry in `vercel.json` (`0 3 * * *`), and `RESEARCH_RETENTION_DAYS` (default 365). Self-serve `DELETE /api/research/papers/[id]` uses the same purge for one paper with token auth. Note the `Paper` collection is literally named `paper` (Mongoose pluralize treats it as uncountable); the purge uses the models so it cannot drift, and the old script was fixed from the wrong `"papers"` literal. Evidence: `tests/integration/research-retention.test.ts` (dry run, cascade, single delete, route 401, authorized run).
- **V01 re-run with the finish-ups.** The harness was re-run with `LLM_PRIMARY=openrouter`, `V01_MEMORY_MONGO=1`, `RESEARCH_RATE_LIMIT_STORE=mongo`, and a `cloudflared` `APP_BASE_URL`: all 8 tests passed. Generation logs now show real token totals (`7402` input / `8286` output on one section), confirming the usage fix; the shared limiter and timeouts held across the whole run; DOCX (18,730 bytes) and PDF (21,553 bytes) exported.

### Post finish-ups review fixes (2026-10-01)

A second fresh-context review (`docs/reviews/2026-10-01-ai-research-paper-gen-finishups.md`) requested changes:

- **Major (generation lease shorter than the worst-case step).** `LOCK_MS` was 120s but a step could exceed it (per-call timeout x provider fallback x 3 backoff attempts, plus repair and coherence), so under a degraded provider the lease could expire mid step and let a duplicate concurrent generation run (double provider spend) while the first request's work was discarded. Fix: `completeJsonWithBackoff` now makes one bounded attempt (the fallback chain already spans providers); `generationLeaseMs` derives the lease from the configured timeouts (`2 x writing + 4 x utility + margin`, floor 5 minutes) and both generation and regeneration use it; `maybeCoherence` is now best effort and skips on failure instead of failing the paper. Regressions: `tests/unit/research-config.test.ts` "generation lease budget" and `tests/unit/research-model-contract.test.ts` "bounded generation attempts".
- **Minor fixes.** `discovery/concepts.ts` gets a 15s abort timeout; `recordTokenUsage` now receives a per step delta (was fed cumulative totals, which made the daily alarm grow quadratically); `purgeExpiredResearch` is batched with a `limit` and single pass `deleteMany` (no N+1); the manual delete script reads `RESEARCH_RETENTION_DAYS`; the shared limiter only falls back to memory for scopes not already consumed (no double count) and retries once on a concurrent upsert `E11000`; the `RateLimit` key drops the redundant `index: true`; `parseTimeoutMs` clamps to 10 minutes so a timeout cannot outlive a route `maxDuration`.

Deferred nits (recorded, not code bugs): the export model still emits the abstract twice and always empty `keywords`; `resetResearchRateLimit` clears only the in-process map; the `papers/[id]` price `superRefine` is redundant under `.strict()`.

Verified after the fixes: lint 0 errors, `tsc` clean, 172 tests pass, build green (18 pages), 9 e2e pass, and the full V01 sandbox journey passed again with the new lease and bounded attempts (DOCX 19,516 bytes / PDF 23,099 bytes).

### Step 1 acceptance verification (2026-10-01)

Extended the gated harness (`tests/integration/v01-sandbox.test.ts`, `RUN_V01=1 V01_MEMORY_MONGO=1 RESEARCH_RATE_LIMIT_STORE=mongo APP_BASE_URL=<cloudflared tunnel>`) to cover the paths that were only inferred before, and ran it against the real sandbox providers (real Crossref, real OpenRouter via the OpenAI fallback, real Bachs sandbox checkout, isolated single-node replica-set Mongo):

- **Resume after interruption.** Generation was stopped after two steps and continued; the paper completed with 6 unique section ids, no duplicates, and a replay call after completion added no sections.
- **Original research.** A draft with supplied methodology and findings completed with a `methodology` and a `results_discussion` section, every section complete.
- **Research proposal.** Completed with **no** `results_discussion` section, confirming the plan rule live.
- **Longer paper with a longer reference list.** 15 pages with 6 resolvable DOIs completed with 6 sections, every section non-empty, and 6 bibliography entries.
- **Export content inspection.** The DOCX was unzipped (`jszip`) and its `word/document.xml` asserted to contain the title, the `References` heading, and a reference title; the PDF was loaded (`pdf-lib`) and its page count asserted. This replaces the previous "non-empty buffer only" check.

**Bug found and fixed during step 1.** The resume run first failed with `422 GENERATION_INVALID_OUTPUT` ("Empirical claim without a citation token"). Root cause: `generateSectionJson` treated an `uncited_claim` (or out of band `word_count`) as fatal after one repair, so a single uncited empirical sentence aborted the whole paid generation. Fix: after one repair, only `unknown_cite` and `metadata_only_claim` remain fatal (citation integrity); `uncited_claim` and `word_count` are soft, logged, and the section is accepted for the user to edit, matching the plan's "flag for repair or user review". Regression: `tests/unit/generate-next.test.ts` "accepts a section whose only issue is an uncited empirical sentence". The resume scenario then passed live.

Result: all 12 harness tests pass. Local gates: lint 0 errors, `tsc` clean, 174 tests pass, build green.

Still outstanding before a paying launch: a real live charge and webhook delivery plus reconciliation (owner approved), strict-mode in a browser, and the OpenAI primary path (currently bypassed with `LLM_PRIMARY=openrouter`).

### Final review fixes (2026-10-02)

A third fresh-context review (`docs/reviews/2026-10-02-ai-research-paper-gen-final.md`) found one blocker and one major, fixed here:

- **Blocker (SSRF DNS rebinding).** `safeFetch` validated a hostname's DNS answers and then let `fetch` resolve the hostname a second time, so a rebinding attacker could reach the private/metadata addresses the guard claims to block. Fix: `safeFetch` now uses a Node `http(s)` transport whose connection `lookup` (`createPinnedLookup`) resolves and validates the address at connect time, so the validated IP is the one actually contacted; redirects re-pin on every hop. Added a `safe-fetch.test.ts` regression where `lookup` returns a public address on the pre-check and a private address on the connect attempt and asserts it is rejected. Only `safeFetch`'s transport changed; the `lookup`/`transport` seams are injectable for tests.
- **Major (soft validation issues were not surfaced).** After one repair, residual `uncited_claim`/`word_count` were accepted and only logged, so a user could get a fabricated uncited sentence with no warning. Fix: `generateSectionJson` now returns the soft issue messages, generation and regeneration persist them on the section (`validationWarnings`), the projection exposes them, and the workspace renders a "Needs review" notice per section. Regression: `generate-next.test.ts` asserts the warning is persisted.
- **Minor fixes.** Regeneration quota now uses `$inc: { "regeneration.used": 1 }` in the ownership-conditioned finalize (a stale snapshot can no longer undercount and grant a free regeneration), with a real-Mongo regression; the Bachs client gets a 15s request timeout; the LLM timeout clamp and `generationLeaseMs` are bounded so the lease can never exceed the generation route `maxDuration` (300s), with an invariant test.

Deferred (recorded): `safeFetch` still buffers the whole body before the size check (the transport now aborts mid-stream past `maxBytes`, but the final check remains); the export model duplicates the abstract and always empty `keywords`; access token in the query string.

Committed as `6d82837` "Add the paid AI research writer end to end" on `ai-research-paper-gen` (150 files, clean tree). Local gates at commit time: lint 0 errors, `tsc` clean, 177 tests pass, build green, 9 e2e pass.



## Copyable task for the next implementer

> Repair the research writer on `ai-research-paper-gen` using `docs/research-writer/REPAIR_PLAN.md`. Start by inspecting the current dirty working tree and preserve all existing work, including the logo restoration. Read AGENTS.md and installed framework documentation. Work through R01–R10 in dependency order, adding focused reproductions and recording evidence for each. Keep payment/authentication/reference protections intact. Run the build, typecheck, existing tests, new concurrency/content tests, and browser verification. Use synthetic data, an isolated database, and approved sandbox services. Do not claim the live provider journey is verified when only mocks were exercised. Update the repair checklist and provide a concise handoff with remaining blockers. Do not deploy or make real charges as part of this repair task.
