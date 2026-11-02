# TODO · Quality

Tests, evals and fixtures: code that changes no product behaviour but proves it. Index and conventions: [`TODO.md`](TODO.md). Items from the 2026-10-26 review cite [`docs/engineering/project-audit-2026-10-26.md`](docs/engineering/project-audit-2026-10-26.md).

## P2 · Polish and evidence

- [~] **End-to-end smoke test** `P2`
  - **Context:** the draft workspace and the chat now have React Testing Library tests (`tests/components/`: approval, confirmation with unresolved items, autosave, the unsaved-changes prompt, sending and the discard-edits confirmation), but no test drives the running app through sign-up, a project and a publish. The app has no way to run on fake GitHub, Jira and model providers, so a browser test would need real credentials.
  - **Fix:** add a test-only provider set (selected by an env flag that `env.ts` refuses in production) with a fixture repository, an in-memory tracker and a canned generator, then one Playwright run against the local stack (the same fake providers can feed a separate demo clone later): sign up, create a project, draft, approve, and check the issue in the fake tracker.

- [ ] **Organization actions have no tests** `P2`
  - **Context:** `src/features/organizations/actions.ts` wraps Better Auth for invitations, roles, removal, leaving and deletion, and no test calls any of them; `disconnectConnection` is untested too. The invitation bug in [`TODO-BUG.md`](TODO-BUG.md) went unnoticed because nothing exercises these flows.
  - **Fix:** add PGlite integration tests through the real Better Auth instance: an admin invites and the invitee accepts; a member cannot invite, change roles or remove; only the owner deletes; leaving or deleting moves the user to their next organization; another organization's ids are refused; `disconnectConnection` refuses a connection that a project uses.

- [ ] **Unit tests for `extractTerms`** `P2`
  - **Context:** the 2026-10-26 review ran `extractTerms` by hand on English and French requests (B3), but nothing pins its behaviour. It feeds the Jira search, the excerpt windows and the agent's query, so a stopword or synonym change silently shifts retrieval.
  - **Fix:** add `tests/unit/terms.test.ts`: English and French requests, quoted literals dropped, accents stripped, synonyms appended after the primary terms, the `max` cap, and short words skipped.

- [ ] **Small pure helpers without tests** `P3`
  - **Context:** `estimateCostUsd` (`src/features/analysis/cost.ts`), `withoutIncompleteItems` (`src/core/requirements/schemas.ts`) and `excerptAllowances` (`src/core/context/retrieve.ts`) carry decisions that are easy to break and have no direct test.
  - **Fix:** one table-driven test each: unknown model and missing usage return `null`; blank items are dropped but not partial ones; the shared budget tops up long files in selection order and never exceeds the total.
