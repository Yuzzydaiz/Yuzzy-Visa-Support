# Research writer baseline (C00)

Recorded 14 September 2026, before C01–C04 library work.

## Commands

Run via local binaries (`./node_modules/.bin/eslint` and `./node_modules/.bin/next build`) because `pnpm lint` / `pnpm build` currently fail first: pnpm tries `pnpm install` and exits on `ERR_PNPM_IGNORED_BUILDS` (`esbuild@0.27.0`). That is a **pre-existing** toolchain issue, not a research-writer regression.

| Command | Result |
| --- | --- |
| `./node_modules/.bin/eslint .` | Exit 0. 0 errors. 3 warnings in Convex generated files (unused `eslint-disable`). |
| `./node_modules/.bin/next build` | Exit 0. Routes: `/`, `/_not-found`, `/robots.txt`, `/sitemap.xml`. |

### Pre-existing lint warnings

- `convex/_generated/api.js`
- `convex/_generated/server.d.ts`
- `convex/_generated/server.js`

Do not treat these as new failures from research-writer work.

## Repo facts (re-inspect)

- App Router under `app/` (marketing home in `app/(marketing)/page.tsx`).
- Convex for contact and subscribers. Untouched in C00–C04.
- No mongoose, zod, vitest, OpenAI, Bachs, TipTap, or `docx` packages at baseline.
- Env files belong at **repo root**. Next.js does not load `api/.env.local`.

## Layout correction

A root `api/` folder with Mongo env was removed. `MONGODB_URI` was merged into root `.env.local` (gitignored). Plan Appendix B uses `MONGODB_URI` only; username/password/connection-string aliases are not first-class config.

## Folder contract deviation

C00 does **not** add empty `app/research/**` or `app/api/research/**` route files. Those would publish empty URLs. Pages and route handlers start in later chunks (C05+ / C13+). Server modules live under `lib/` and tests under `tests/`.
