# TODO · Quality

Tests, evals and fixtures: code that changes no product behaviour but proves it. Index and conventions: [`TODO.md`](TODO.md). Items from the 2026-10-26 review cite [`docs/engineering/project-audit-2026-10-26.md`](docs/engineering/project-audit-2026-10-26.md).

## P2 · Polish and evidence

- [ ] **Run the end-to-end smoke test in CI** `P2`
  - **Context:** `pnpm e2e` (`tests/e2e/smoke.spec.ts`) signs up, connects the fake providers, creates a project, drafts and publishes, but only runs locally: CI has no Postgres service or Playwright browser, so a change that breaks the flow is caught only when someone remembers to run it.
  - **Fix:** add a CI job with a `postgres:17` service mapped to port 5434 (or set `E2E_DATABASE_URL`), `pnpm exec playwright install --with-deps chromium`, then `pnpm e2e`; upload `test-results/` on failure. It rebuilds the app, so run it after `check` or reuse that job's build.
