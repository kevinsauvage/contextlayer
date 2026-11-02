# TODO · Refactors

Code structure and cleanup that change no behaviour: dead code, duplication, tooling and framework conventions. Index and conventions: [`TODO.md`](TODO.md). Items cite the finding in [`docs/engineering/project-audit-2026-10-26.md`](docs/engineering/project-audit-2026-10-26.md).

## P3 · Later: optional features and deeper hardening

- [ ] **One helper turns a Jira issue into evidence** `P3`
  - **Context:** `issueEvidence` in `src/core/context/gather.ts` and the audited-ticket candidate in `auditIssue` (`src/core/analysis/analyze.ts:64`) build the same excerpt (`summary [status]\ndescription`, 1,500 chars) twice: one trims, the other writes "(no description)".
  - **Fix:** export one `issueEvidence(issue)` from `src/core/context`, use it in both places, and pick one rule for an empty description.

- [ ] **Remove duplicated reconnect and grant-scope code in integrations** `P3`
  - **Context:** the Jira provider handles a 401 twice, once in `withJiraAuth` and once in the `onUnauthorized` callback of `openTracker` (`src/integrations/jira/provider.ts`). `access.ts` builds the "this grant, or this connection" filter twice, in `refreshGrant` and `markReconnect`.
  - **Fix:** have `openTracker` reuse `withJiraAuth` (or a shared `reconnect(ctx)`), and extract `grantScope(connection)` in `access.ts`.

- [ ] **Look providers up in one place** `P3`
  - **Context:** `src/features/integrations/resolve.ts` says features reach providers through `providerById` instead of the registry, but `src/features/projects/view.ts` imports `findProvider` from `@/integrations/registry` directly.
  - **Fix:** use `providerById` in `view.ts`, and add a `.dependency-cruiser.cjs` rule that allows only `features/integrations/resolve.ts` and `overview.ts` to import `src/integrations/registry`.

- [ ] **Replace the price table** `P3`
  - **Context:** `src/features/analysis/cost.ts` keeps hand-typed prices for four model ids; any other model shows no cost, and the table goes stale silently. The usage of a generation that `pRetry` discarded is not counted either.
  - **Fix:** when the model goes through the AI Gateway, check whether its response metadata carries the request cost (`node_modules/ai/docs`, gateway provider) and store that per run; otherwise keep the table but test that the configured `AI_MODEL` is listed. Add the discarded attempt's usage to the total.
