# TODO · Quality

Tests, evals and fixtures: code that changes no product behaviour but proves it. Index and conventions: [`TODO.md`](TODO.md).

## P3 · Harden and validate

- [~] **End-to-end smoke test** `P3`
  - **Context:** the draft workspace and the chat now have React Testing Library tests (`tests/components/`: approval, confirmation with unresolved items, autosave, the unsaved-changes prompt, sending and the discard-edits confirmation), but no test drives the running app through sign-up, a project and a publish. The app has no way to run on fake GitHub, Jira and model providers, so a browser test would need real credentials.
  - **Fix:** add a test-only provider set (selected by an env flag that `env.ts` refuses in production) with a fixture repository, an in-memory tracker and a canned generator, then one Playwright run against the local stack: sign up, create a project, draft, approve, and check the issue in the fake tracker.
