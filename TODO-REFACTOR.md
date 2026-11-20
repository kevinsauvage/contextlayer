# TODO · Refactors

## P3 · Later: optional features and deeper hardening

Items from the 2026-11-20 portfolio review (`pnpm knip` and `pnpm deps:check` were clean again).

- [ ] **Project pages run the same queries twice per request** `P3`
  - **Context:** the project layout (`src/app/(app)/projects/[projectId]/(work)/layout.tsx:17-19`) calls `getProject` and `projectIntegrations`; each page under it calls `getProject` again (`page.tsx:16`, `audit/page.tsx:18`, `history/page.tsx:20`, `settings/page.tsx:14`) and the audit page calls `projectIntegrations` again (`:20`), two more connection lookups. Opening the audit tab costs six queries where three would do. `requireOrgContext` already shows the pattern: it is wrapped in React `cache()`.
  - **Fix:** wrap `getProject` and `projectIntegrations` in `cache()` (keyed on primitive arguments, so pass `organizationId` and `projectId` rather than the `db` object), and check the query count with Drizzle's logger on one page load.

- [ ] **The history list loads and parses every analysis's full result** `P3`
  - **Context:** `listAnalyses` (`src/features/projects/queries.ts:52`) runs `select()` on `analysis`, so 50 rows bring back `result`, `editedResult`, `evidenceIssues` and `input` (each holding source excerpts up to 60,000 characters). `AnalysisStatusBadge` then Zod-parses every draft (`storedDraft`) only to count open questions and `needs_clarification` claims. The page needs a title, kind, status and that count.
  - **Fix:** select only the list columns, plus the readiness inputs computed in SQL (`jsonb_array_length` on `openQuestions`, a count of `needs_clarification` claims, whether any stored issue blocks), or store a small `readiness` jsonb column written in `recordOutcome` and `saveDraftEdits`. Keep `AnalysisStatusBadge`'s output unchanged and cover it with the existing `history.test.ts`.

- [ ] **Hand-written plurals next to `countLabel`** `P3`
  - **Context:** `disconnect-button.tsx:12` and `provider-card.tsx:61` build "project"/"projects" by hand, and `resource-picker.tsx:59` special-cases `noun === "repository"`, although `countLabel` (`src/lib/count.ts`) exists for this. A third provider whose noun is irregular would read wrong.
  - **Fix:** use `countLabel` for the project counts, and add a `resourceNounPlural` to the provider descriptor (`PROVIDER_DESCRIPTOR_KEYS` in `src/core/integrations/provider.ts`) for the picker.

- [ ] **Leftover create-next-app assets in `public/`** `P3`
  - **Context:** `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg` and `window.svg` are the scaffold's files; nothing in `src` or the docs references them, and knip does not check `public/`. A reviewer browsing the repository reads them as an unfinished setup.
  - **Fix:** delete them; if the app needs an icon, export the `Logo` mark as `src/app/icon.svg`.
