# TODO · Quality

Tests, evals and fixtures: code that changes no product behaviour but proves it. Index and conventions: [`TODO.md`](TODO.md). Items from the 2026-10-26 review cite [`docs/engineering/project-audit-2026-10-26.md`](docs/engineering/project-audit-2026-10-26.md).

## P1 · Quality: make the core promise hold

- [ ] **Fair baseline in the evaluation** `P1` `C2` `E2`
  - **Context:** the baseline in `tests/evaluation/baseline.eval.ts` receives only the ticket title and no repository, and the judge prompt scores `evidenceTraceability` as "text without citations scores 0", so the baseline loses by construction. The 45 vs 12 vs 11 result cannot support C2. The real alternative is an AI that can read the code.
  - **Fix:** add a second baseline that gets the same retrieved candidates as ContextLayer with a plain "write a Jira ticket" prompt, so the comparison isolates claim statuses and citations. Score `evidenceTraceability` for it on whether each claim names its file, not on a structured citation list. Keep the title-only baseline as a floor, report all three, and update E2 in `validation-experiments.md`. The repo-aware agent comparison is in [`TODO-NON-CODE.md`](TODO-NON-CODE.md).

## P2 · Polish and evidence

- [~] **End-to-end smoke test** `P2`
  - **Context:** the draft workspace and the chat now have React Testing Library tests (`tests/components/`: approval, confirmation with unresolved items, autosave, the unsaved-changes prompt, sending and the discard-edits confirmation), but no test drives the running app through sign-up, a project and a publish. The app has no way to run on fake GitHub, Jira and model providers, so a browser test would need real credentials.
  - **Fix:** add a test-only provider set (selected by an env flag that `env.ts` refuses in production) with a fixture repository, an in-memory tracker and a canned generator, then one Playwright run against the local stack (the same fake providers can feed a separate demo clone later): sign up, create a project, draft, approve, and check the issue in the fake tracker.
