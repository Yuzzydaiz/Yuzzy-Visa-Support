# Review, ai-research-paper-gen, 2026-09-30

**Reviewed by**: GPT-6 Codex (author on cursor-grok-4.6)
**Scope**: 132 changed/untracked files, branch vs main including staged and working-tree research changes; detailed review concentrated on research generation, payment, persistence, editor, and export paths.
**Verdict**: Blocked

## Summary
The feature separates payment, access, references, generation, and export into useful modules, and payment success checks signatures and server-calculated amounts. It is suitable for further development testing but not acceptance testing or merge: generated output has an incomplete model contract, concurrency protection is not enforced by the database, and editor regeneration can lose content. Mock-based tests do not establish that a real model or concurrent MongoDB requests behave correctly.

## Blockers
### 🔴 [P1] Restore the production build, `components/research/payment-status.tsx:44`
**Problem**: `pnpm build` compiles the application and then exits 1 with “Failed to type check.” The independent typecheck reports 47 errors in nine files; the first passes `string | undefined` to `encodeURIComponent` here. Further errors affect generation state, model-document typing, and export author types.
**Why it matters**: The branch cannot produce a production deployment. Passing unit and mocked browser tests do not remove this blocker. `.github/workflows/research-checks.yml` runs lint and tests but omits build/typecheck, allowing CI to miss it.
**Suggested fix**: Correct the nullable and document types without suppressing the checks, rerun the full production build, and add a typecheck/build gate to CI. The build was retried outside the network sandbox to allow Google Fonts fetching, so the confirmed failure is TypeScript rather than the initial network restriction.

### 🔴 [P1] Clear obsolete pending edits after regeneration, `components/research/paper-workspace.tsx:128`
**Problem**: `queueSave` sets `pendingDoc.current`, but successful PATCH never clears it. Regeneration updates the paper state and advances `editorVersion.current` without replacing or clearing that pending document. After editing and saving, regenerating, then changing browser visibility, `flush` submits the old document with the NEW editor version.
**Why it matters**: The server accepts the stale content and silently undoes the paid regeneration. Pending debounce timers can do the same; the regenerated text and consumed quota diverge.
**Suggested fix**: Serialize pending saves and regeneration, clear only the acknowledged pending revision, and cancel obsolete timers/documents when accepting regenerated content. Cover edit-save-regenerate-hide-return explicitly.

## Major
### 🟠 [P1] Supply the section output schema to the model, `lib/research/generation/next.ts:165`
**Problem**: Section generation requires `sectionId`, `title`, `paragraphs`, `usedReferenceIds`, and `wordCountEstimate` in `sectionJsonSchema`, but neither system nor user prompt describes this shape. The section ID is not sent at all. The adapter requests only `json_object`, not a JSON schema. A valid JSON response containing ordinary section prose therefore fails before the repair path.
**Why it matters**: Tests return hand-authored schema-compliant JSON, masking a missing contract in the real provider call. Paid generation depends on the model guessing private field names and types.
**Suggested fix**: Send a supported structured-output schema and the actual section ID, explicitly constrain the response to that section, and test the outgoing provider request contract.

### 🟠 [P1] Include the customer's methodology and findings in writing requests, `lib/research/generation/next.ts:173`
**Problem**: The persisted `actualMethodology`, `actualFindings`, and `researchNotes` are absent from all model requests. The first two are only converted to booleans when allocating the outline. `sectionUserPrompt` receives only title, focus, arguments, planned reference IDs, and reference evidence.
**Why it matters**: An original-research customer supplies their actual results, but the writing model cannot use them. It must either claim missing evidence or invent material despite the instruction to use supplied findings.
**Suggested fix**: Pass bounded user research context, clearly separated from reference evidence, to the relevant outline and section prompts. Assert the supplied findings reach the request in a regression test.

### 🟠 [P1] Claim generation and regeneration atomically, `lib/research/generation/next.ts:461`
**Problem**: The generation lock is read on an ordinary document and subsequently written with `savePaper`. Two requests can both load an unlocked paper, pass the check at line 395, and begin the same expensive model call. Regeneration similarly reads `used`, calls the model without a lock, and writes `used + 1`; it does not coordinate with generation or other regenerations. `PaperSchema` has no optimistic-concurrency option and the store has no conditional claim operation.
**Why it matters**: Double requests can duplicate provider spend, overwrite results, or generate multiple outputs against the same remaining quota. The tests' shared in-memory paper object does not reproduce separate MongoDB document snapshots.
**Suggested fix**: Add a conditional database claim with an ownership token, status/version predicate, bounded lease, and conditional finalization. Reserve regeneration capacity under the same concurrency discipline and release on failure. Test independently loaded snapshots concurrently.

### 🟠 [P1] Enforce editorVersion in the update predicate, `lib/research/papers/patch.ts:91`
**Problem**: Optimistic concurrency is only a JavaScript comparison against a previously fetched document; the eventual `paper.save()` is not conditioned on the client editor version. Two title/style PATCH requests loaded at the same version can both pass, both save, and both return success instead of one returning 409.
**Why it matters**: The explicit two-tab conflict contract is not enforced, so concurrent saves can silently replace settings or edits. Mongoose's default array versioning is not equivalent to optimistic concurrency for all these fields.
**Suggested fix**: Perform a compare-and-swap update on `publicId` and `editorVersion`, increment the version atomically, and return 409 when no document matches. Test concurrent requests against real persistence or a store that models snapshot isolation.

### 🟠 [P1] Number citations across the whole paper, `lib/research/export/model.ts:55`
**Problem**: Each section invokes `renderCitations` separately; its numeric map starts at 1 on every invocation. The bibliography is built from all sections together in `applyPaperBibliography`. For example, section one citing ref_01 and section two citing ref_02 both print [1], while the bibliography labels ref_02 [2]. `applyRenderedSection` has the same mismatch.
**Why it matters**: IEEE and Vancouver documents attribute claims to the wrong bibliography item in exported files and saved section text.
**Suggested fix**: Establish one paper-wide citation-number map and reuse it for all sections and the bibliography. Verify two sections citing different sources in both export formats.

### 🟠 [P1] Validate coherence replacements before persisting, `lib/research/generation/next.ts:306`
**Problem**: The coherence response replaces validated sections after checking only whether parsed citation IDs belong to the manifest. It does not call `validateSectionOutput`, enforce the word budget, or recheck detailed empirical claims against metadata-only sources. A replacement with no citation tokens passes the ID check vacuously.
**Why it matters**: The final pass can remove citations, introduce unsupported numerical claims, or shrink the paper dramatically and still mark it completed. Earlier section validation no longer protects the delivered document.
**Suggested fix**: Apply a bounded schema and the same evidence/word/citation validation to proposed replacements, retain the original when invalid, and test a coherence response containing an uncited empirical assertion.

### 🟠 [P1] Preserve editor content that users are allowed to create, `lib/research/editor/document.ts:133`
**Problem**: `tiptapDocToSections` saves only headings and top-level paragraphs; StarterKit also enables lists, blockquotes, and code blocks. Pasted or keyboard-created list/blockquote content is ignored. Inline formatting marks are stripped during conversion, and the original TipTap document is never persisted.
**Why it matters**: The editor reports Saved while content disappears after reload and from exports. This contradicts the contract that TipTap JSON is the source of truth.
**Suggested fix**: Persist and validate the supported structured document, deriving section/export text without discarding it; alternatively restrict the editor to a deliberately supported node set. Test pasted lists and formatting through save/reload/export.

### 🟠 [P2] Make the required checkout email discoverable, `components/research/paper-details-form.tsx:283`
**Problem**: The order-email field is inside collapsed “Optional details” and labelled “Email for this order (optional)”, but checkout rejects an empty value in `research-wizard.tsx:225`.
**Why it matters**: Real computer-use verification completed the advertised required fields, resolved a source, reached review, and then received “Add an email for this order before payment.” The user must return to details and discover a supposedly optional hidden field before proceeding.
**Suggested fix**: Present the required order email among required fields and validate it before leaving details, or collect it visibly at checkout with accurate required-field text. Verify the ordinary new-customer flow without opening optional details.

## Strengths
- Checkout re-resolves sources on the server and calculates money from validated server config rather than trusting browser claims.
- Webhook verification uses raw-body HMAC, a replay window, amount/currency checks, and a transaction for payment-to-ready state changes.
- Access tokens are hashed with a pepper; generation and editor endpoints authenticate before exposing paper content.

## Test coverage
- `pnpm test`: 129/129 tests pass across 21 files.
- `pnpm lint`: zero errors and three existing generated-file warnings.
- Typecheck: 47 errors across nine files. `pnpm build` compiles, then fails its typecheck (exit 1).
- Playwright: 6/6 tests pass, with research API responses mocked.
- Real desktop computer use: details → references → review navigation works; DOI `10.1038/nature14539` resolves to *Deep learning* (2015), clearly labelled Metadata only. The 10-page estimate displays ₦2,500. Refresh retains the entered title, author name, and affiliation. Missing-email checkout failure reproduced as described above.
- Mobile computer use at 390×844: form remains readable and the header consultation CTA remains available.

These handler and browser tests are useful but do not prove MongoDB concurrency, real model output conformance, or sandbox payment-to-generation completion. No paid checkout, live generation, or live export flow was verified; no real payment, live model spend, or production write was performed. Add focused regressions for the concrete defects above and complete the sandbox full-flow check after the build and runtime defects are fixed.
