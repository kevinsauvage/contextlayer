# TODO · Quality

Tests, evals and fixtures: code that changes no product behaviour but proves it. Index and conventions: [`TODO.md`](TODO.md).

## P1 · Prove the product

- [ ] **Grow the fixtures from 4 to 8–10** `P1` `C3`
  - **Context:** `tests/fixtures/` has four miniature repositories; C3 asks for 8 to 10, and there is no case with a Jira issue or a duplicate ticket.
  - **Fix:** add `case.json` plus `repo/` for a Jira-issue audit, a duplicate-ticket case, the "banner title" miss (copy in an imported content module), a multi-paragraph request, and a prompt-injection file. `tests/unit/fixtures.test.ts` validates the shape.

- [~] **Assert forbidden claims in evals** `P1` `C3`
  - **Context:** the baseline judge now includes `forbiddenClaims` and `mustStayUncertain` in its rubric (`requirementFidelity`, `uncertaintyHandling`), but `analysis.eval.ts` still only checks evidence references, so a case cannot fail on a forbidden claim.
  - **Fix:** assert the verdict per case — fail a case that presents a forbidden claim as a requirement or marks an uncertain fact `verified` — and write the pass/fail to `results/<case>.json`.

- [ ] **Evaluate the clarification loop** `P1`
  - **Context:** answers (`answerQuestions`) and chat refinements (`refineTicket`) regenerate the draft, but no eval checks that the model applies them.
  - **Fix:** add eval cases with prepared answers and refinements. Assert that answered questions disappear from `openQuestions`, the answer shows up in the description or criteria, a blank answer keeps its question open, and a later refinement overrides an earlier answer it contradicts.

## P2 · Connect and deliver

- [~] **Integration failure tests** `P2`
  - **Context:** tenant isolation, the refresh-token race, rejected refresh tokens and connections in use are covered; GitHub and Jira API errors are not.
  - **Fix:** add tests with a stubbed `fetch`/Octokit for a revoked GitHub installation, a 401 from Jira on a fresh token (mark `needs_reconnect`), a deleted Jira project, and the server actions' error returns.

## P3 · Harden and validate

- [ ] **AI regression coverage** `P3`
  - **Context:** no test checks that injected instructions in repository content are ignored, and `pnpm eval` is too slow and costly for CI.
  - **Fix:** add fixtures with files that say "ignore your instructions" or try to set claim statuses; assert the draft does not follow them. Add a two-case eval subset that CI can run nightly with a cheap model.

- [ ] **Raise the coverage floor** `P3`
  - **Context:** coverage is about 47% of statements against a 40% floor; feature actions, the OAuth flow and integration error paths are the weak spots.
  - **Fix:** add tests for `finishConnect`, `createProject`, `refineTicket` and the error paths above, then raise the floor in `vitest.config.mts` to the new level minus a small margin.
