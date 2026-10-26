# TODO · Refactors

Code structure and cleanup that change no behaviour: dead code, duplication, tooling and framework conventions. Index and conventions: [`TODO.md`](TODO.md). Items cite the finding in [`docs/engineering/project-audit-2026-10-26.md`](docs/engineering/project-audit-2026-10-26.md).

## P2 · Production-grade: security, limits, deploy, reliability

- [ ] **Remove legacy compatibility code and squash the migrations before the first deploy** `P2`
  - **Context:** the legacy `title` input (`src/core/analysis/schemas.ts:11`, `src/features/analysis/input.ts:15`) only serves rows from before 2026-10-23, and eight migrations include three backfills (`drizzle/0003` to `0005`). Until the first production deploy the only data is local, so this is safe now and unsafe after: once the site has real rows, migrations may only be added.
  - **Fix:** delete the legacy schema and the `title` branch in `readAnalysisInput`, reset the local database, and regenerate a single migration with `pnpm db:generate`. Do it before the production database is created.

- [ ] **Next.js housekeeping** `P2`
  - **Context:** several settings and conventions differ from the installed Next.js docs: three `as Route` casts bypass `typedRoutes` (for example `src/components/auth/auth-form.tsx:19,71`); there is no `global-error.tsx`; `src/app/(app)/error.tsx:10` points users to "support"; the environment is validated on first use instead of at startup; `next.config.ts:15-20` uses `@tailwindcss/turbopack` where the docs use `@tailwindcss/postcss`.
  - **Fix:** keep the two `maxDuration` exports (a serverless host enforces that limit), replace the casts with a helper that returns a typed `Route`, add `global-error.tsx`, fix the error copy, call `getEnv()` from `instrumentation.ts`, and decide whether to keep the Turbopack loader (record it in `DECISIONS.md`).

## P3 · Polish and later

- [ ] **Keep one layer-enforcement mechanism** `P3`
  - **Context:** `tests/unit/architecture.test.ts` (86 lines of regex) duplicates the `no-restricted-imports` rules in `eslint.config.mjs`. The test also holds the one rule ESLint lacks: `core` may import only `zod`.
  - **Fix:** express the layer rules and the `core` allow-list in ESLint (for example with `eslint-plugin-boundaries`), then delete the test and update the "Clean architecture" bullet in `AGENTS.md` if it changes.

- [ ] **Replace the price table** `P3`
  - **Context:** `src/core/analysis/pricing.ts` hard-codes four models "as of 2026-10-26" and a model without an entry records no cost. It will go stale, and the usage caps in [`TODO-FEATURE.md`](TODO-FEATURE.md) need a reliable cost per analysis.
  - **Fix:** read cost from the AI Gateway response metadata when the Gateway is used. Otherwise keep `input_tokens` and `output_tokens` and compute dollars when reporting, then drop the `cost_usd` column and `pricing.ts`.

- [ ] **Move the `#subdirectory` convention out of `core`** `P3`
  - **Context:** `src/core/integrations/provider.ts:20-39` defines a GitHub-style `owner/repo#apps/web` scope, and `src/features/projects/actions.ts` and the project form use it directly, so a core module carries a provider detail.
  - **Fix:** give `SourceProvider` a `scopeResource(resourceId, subdirectory)` method implemented by the GitHub provider, and remove `RESOURCE_SCOPE_SEPARATOR`, `parseResourceScope` and `withResourceSubdirectory` from `core`.

- [ ] **Load the resource picker on the server** `P3`
  - **Context:** `src/components/integrations/resource-picker.tsx` fetches `app/api/integrations/connections/[connectionId]/resources/route.ts` from an effect with its own loading, error and retry state.
  - **Fix:** render the list in a Server Component inside `Suspense` (retry through `error.tsx` and `reset`), pass it to a small client component that only filters and selects, and delete the route handler.
