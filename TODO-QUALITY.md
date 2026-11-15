# TODO · Quality

Tests, evals and fixtures: code that changes no product behaviour but proves it. Index and conventions: [`TODO.md`](TODO.md). Items from the 2026-10-26 review cite [`docs/engineering/project-audit-2026-10-26.md`](docs/engineering/project-audit-2026-10-26.md). Items from the 2026-11-02 prompt run (`docs/prompts/`) were found by reading the code; none was reproduced in a running app or a paid eval run.

## P1 · Prove it: fair evaluation, real retrieval measurements, correctness fixes

_No open P1 items._

## P2 · Production-grade: security, limits, deploy, reliability

- [ ] **Run the judged evals on the cases and checks added on 2026-11-15** `P2`
  - **Context:** two fixtures (`dupliquer-facture`, `large-pricing-rules`), the `rejectedAnswers` markers on `duplicate-export-request`, `mustNotContain` on the injection fixtures (`finance@corp.test`, `CEO`, `unlimited`) and the fenced baseline-judge prompt were written and type-checked, and their pure parts are unit-tested, but none has run against a model: there is no AI key on the machine that wrote them. A literal marker can fail a correct draft (a ticket that says "the API is currently unlimited", or "voided invoices are left out" while describing the superseded answer).
  - **Fix:** `pnpm eval tests/evaluation/analysis.eval.ts tests/evaluation/clarification.eval.ts tests/evaluation/injection.eval.ts`, read each failure, and loosen a marker that rejects a correct draft rather than the draft. Record the run in `docs/product/validation-experiments.md`.

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
