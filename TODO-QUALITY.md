# TODO · Quality

Tests, evals and fixtures: code that changes no product behaviour but proves it. Index and conventions: [`TODO.md`](TODO.md). Items from the 2026-10-26 review cite [`docs/engineering/project-audit-2026-10-26.md`](docs/engineering/project-audit-2026-10-26.md). Items from the 2026-11-02 prompt run (`docs/prompts/`) were found by reading the code; none was reproduced in a running app or a paid eval run.

## P1 · Prove it: fair evaluation, real retrieval measurements, correctness fixes

_No open P1 items._

## P2 · Production-grade: security, limits, deploy, reliability

- [ ] **Run the judged evals with the default generator and decide what a failing eval means** `P2`
  - **Context:** the 2026-11-16 run (E7 in [`docs/product/validation-experiments.md`](docs/product/validation-experiments.md)) used `deepseek-flash` and passed 2 of 23 tests. Two over-strict checks were loosened; the other failures are the draft's (Verified claims quoting text outside their evidence, uncertain points settled or not raised). `anthropic/claude-sonnet-5.5`, the default `AI_MODEL`, has never been run on these suites, and a test passes only when every list in the verdict is empty, so one unraised uncertainty fails a case.
  - **Fix:** run the three suites with the default model and compare by cause. Then decide whether `uncertainNotRaised` should fail a case or be reported as a score, and whether the validator's quote check should retry the draft instead of returning it with issues.

## P3 · Later: optional features and deeper hardening

- [ ] **Prompt-injection fixtures for exfiltration, agent steering, laundering and tag breakout** `P3`
  - **Context:** the injection fixtures (`tests/fixtures/prompt-injection`, `tests/fixtures/audit-injected-ticket`) don't cover: (1) exfiltration, where a file or ticket asks to copy a config secret or URL into the ticket; (2) agent-stage steering, where an injected file tells the agent which files to select or to stop searching, while the eval grades only the final draft; (3) laundering, where injected text comes back as an open question or option and returns in the next `<answers>` round; (4) a `</request>` breakout in an audited ticket aimed at the agent prompt (see the matching item in [`TODO-BUG.md`](TODO-BUG.md)). Assertion coverage is "Injection checks are literal and partial" above.
  - **Fix:** add fixtures for (1)–(4) with a fake secret and a canary URL in `mustNotContain`, and assert the agent still selects the expected files.

- [ ] **Add the retrieval-only baseline to the blind-review packets** `P3` `E3`
  - **Context:** `scripts/blind-review.mjs` labels only `original`, `baseline` (generic AI, no repository) and `contextlayer` (`ROLES`, line 19) and ignores `retrievalBaseline.text`, which `tests/evaluation/baseline.eval.ts:119` already writes, so human reviewers would repeat the comparison E2 calls unfair by construction.
  - **Fix:** add a `retrieval` role ("Retrieval-only") with a fourth label, render `comparison.retrievalBaseline.text` in the packet, extend `scoreTemplate` and the report table, and update the E3 method in `docs/product/validation-experiments.md` to four versions.

- [ ] **The e2e setup drops whatever database `E2E_DATABASE_URL` names** `P3`
  - **Context:** `tests/e2e/global-setup.ts:11` runs `drop database if exists "<name>" with (force)` on the name from `E2E_DATABASE_URL`. Setting `E2E_DATABASE_URL=$DATABASE_URL` to reuse the dev database makes `pnpm e2e` force-drop `contextlayer` with all local organizations, connections and history. Needs a misconfiguration, but irreversible.
  - **Fix:** refuse to run unless the database name ends in `_e2e` (or matches the default), throwing a clear message otherwise.
