# TODO · Quality

Tests, evals and fixtures: code that changes no product behaviour but proves it. Index and conventions: [`TODO.md`](TODO.md).

## P1 · Prove the product

- [ ] **More audit fixtures** `P1` `C3` `E2`
  - **Context:** auditing is half the product, but only one of the nine fixtures (`stale-ticket-audit`) is `kind: "audit"`, so the audit prompt, finding categories and the proposed ticket have almost no eval coverage.
  - **Fix:** add three or four audit cases: missing or non-testable acceptance criteria, a ticket that duplicates an existing implementation or issue (`relatedIssues`), a claim that conflicts with the code, and a sound ticket that should get few findings. Each needs `expected.forbiddenClaims` and `mustStayUncertain`.

- [ ] **Injection through Jira text and tag breakout** `P1` `C3`
  - **Context:** the only injection fixture (`prompt-injection`) hides the instruction in a repository file. Nothing covers instructions in an audited issue's description or in a related issue, or text that tries to close the `<context>` / `<ticket>` tags (see the prompt bug in [`TODO-BUG.md`](TODO-BUG.md)). `buildAuditPrompt` has no unit test.
  - **Fix:** add an `injection`-tagged audit fixture whose issue description and a related issue carry instructions and a `</ticket>` breakout, so the nightly subset runs it, plus unit tests for both prompt builders asserting untrusted text stays inside its block.

## P2 · Connect and deliver

- [ ] **Tests for publishing and autosave** `P2`
  - **Context:** `publishTicket`, `applyAuditToTracker`, `saveDraftEdits`, `parseApprovedDraft` and `publishApproved` have no tests, although they are the only Jira writes and the approval gate.
  - **Fix:** integration tests with a fake tracker: publishes once and records the key and URL, refuses a second publish, refuses a draft with an evidence issue, maps a reconnect error, reports a tracker failure without recording, refuses to autosave a published or running analysis, and `applyAuditToTracker` updates the audited key only.

## P3 · Harden and validate

- [ ] **UI and end-to-end smoke tests** `P3`
  - **Context:** there are no component or browser tests, so the draft workspace (800 ms autosave, discard confirmation before a redraft, approval confirmation with unresolved items, unsaved-changes prompt) is only checked by hand.
  - **Fix:** add React Testing Library tests for `DraftWorkspace` and `TicketChat`, and one Playwright smoke run (sign up, create a project on fake providers, draft, approve) against the local stack.

- [ ] **Tests for starting a connection** `P3`
  - **Context:** `finishConnect` is tested, but `startConnect` is not: the `not_admin` and `unconfigured` notices, `returnTo` sanitising and the signed state's contents.
  - **Fix:** unit-test `startConnect` with a fake provider for each branch, and assert the state verifies back to the same user, organization, provider and safe `returnTo`.
