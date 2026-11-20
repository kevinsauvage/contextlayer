# Validation experiments

Each experiment tests one or more hypotheses from [`business-hypotheses.md`](business-hypotheses.md). Status: **planned**, **running**, **done**.

## E1: Pipeline sanity (done)

- **Tests:** feasibility of H2, H8.
- **Method:** `pnpm eval` on 4 fixtures with Gemini 3.8 Flash (free tier).
- **Result (2026-10-22):** 4 of 4 drafts passed evidence-reference validation; keyword retrieval found 9 of 10 expected files (misses `mail/send.ts` for "Add password reset"). Forbidden claims are now checked too: the eval judge fails a case that presents one as a requirement or settles an uncertain point.
- **Limit:** 4 fixtures written by the builder; not representative.

## E2: Baseline comparison (running)

- **Tests:** H2, H7.
- **Method:** `tests/evaluation/baseline.eval.ts` scores four versions of each ticket 0 to 2 on six rubric criteria (max 12), using an LLM judge with the fixture ground truth: the original request, a generic AI answer to the request alone (the floor, no repository), a retrieval-only baseline that receives the same retrieved candidates as ContextLayer with a plain "write a Jira ticket" prompt, and the ContextLayer draft. The retrieval-only baseline has no claim statuses and no structured citations, so it isolates what the claim contract adds; traceability for it is scored on whether each claim names the file it came from. Generation by `AI_MODEL`; the judge is `AI_JUDGE_MODEL` (its own endpoint when needed), falling back to `AI_MODEL` with a warning and `judgeIsGenerator: true` in the result file.
- **Fair baseline (2026-10-27):** the three-way run below cannot support C2: the generic baseline saw only the title and no repository while the rubric scores text without citations 0, so it lost by construction. The retrieval-only baseline is the comparison that isolates claim statuses and citations; the tables below predate it.
- **Result (2026-10-23, same-model judge, directional):**

| Case                   | Original | Generic AI | ContextLayer |
| ---------------------- | -------- | ---------- | ------------ |
| checkout-accessibility | 2        | 3          | 11           |
| export-orders-csv      | 2        | 6          | 11           |
| password-reset         | 0        | 5          | 12           |
| slow-dashboard         | 2        | 8          | 12           |

Latency 8 to 20 s for both approaches; output tokens 1.1 to 2.8k for both.

- **Result (2026-10-24, separate judge reading the repository):** generator `deepseek-flash` (DeepSeek-V4.1-Flash), judge `deepseek-v4-pro` (DeepSeek-V4-Pro). The judge gets every fixture file as the source of truth, and `verifiedFacts` only as guidance; ContextLayer drafts are regenerated in the same run.

| Case                   | Original | Generic AI | ContextLayer |
| ---------------------- | -------- | ---------- | ------------ |
| checkout-accessibility | 0        | 0          | 12           |
| export-orders-csv      | 4        | 3          | 11           |
| password-reset         | 4        | 5          | 10           |
| slow-dashboard         | 3        | 4          | 12           |
| **Total (of 48)**      | 11       | 12         | 45           |

ContextLayer: 8 to 14 s, about 1.2k input and 1.2 to 2.2k output tokens per case; retrieval recall 1, 1, 0.67 (misses `mail/send.ts`) and 1. The judge names the generic drafts' errors against the files (for example "no performance budget is enforced", contradicted by `docs/performance.md`). ContextLayer's lost points are partial actionability and acceptance criteria on password-reset and partly testable criteria on export-orders-csv. An earlier run the same day, judged on `verifiedFacts` alone with stale drafts, wrongly marked down a correct claim; its numbers are superseded.

- **Model comparison (2026-10-24, same fixtures and judge prompt):** each model generated with the other as judge.

| Generator → judge | ContextLayer (of 48) | Generic AI | Original | ContextLayer latency | ContextLayer output tokens |
| ----------------- | -------------------- | ---------- | -------- | -------------------- | -------------------------- |
| Flash → Pro       | 45                   | 12         | 11       | 8 to 14 s            | 1.2k to 2.2k               |
| Pro → Flash       | 44                   | 11         | 10       | 29 to 51 s           | 2.7k to 5.0k               |

Pro is 3 to 4 times slower and writes about twice the tokens without a better score; both lose points on the same cases (password-reset actionability and criteria, where retrieval misses `mail/send.ts`). The judges differ between rows, so the gap is indicative, but nothing favours Pro as the generator.

- **Result (2026-10-27, four-way, generator `deepseek-flash`, judge `deepseek-v4-pro`):** same six one-shot cases.

| Case                   | Original | Generic AI | Retrieval-only | ContextLayer |
| ---------------------- | -------- | ---------- | -------------- | ------------ |
| banner-title           | 5        | 8          | 10             | 10           |
| checkout-accessibility | 5        | 2          | 11             | 12           |
| export-orders-csv      | 4        | 1          | 7              | 12           |
| password-reset         | 2        | 2          | 3              | 10           |
| prompt-injection       | 4        | 4          | 10             | 12           |
| slow-dashboard         | 3        | 3          | 8              | 12           |
| **Total (of 72)**      | 23       | 20         | 49             | 68           |

ContextLayer wins 5 of 6 and ties `banner-title`. Per criterion (of 12 each): factualCorrectness 12 vs 8, evidenceTraceability 12 vs 10, requirementFidelity 12 vs 8, actionability 11 vs 10, acceptanceCriteria 12 vs 9, uncertaintyHandling 9 vs 4. The retrieval-only baseline names files for most claims, so the gap is not citation formatting: it decides points the files cannot settle (a 30-minute expiry, the CSV column list, the N+1 cause as a summary fact), which costs it factualCorrectness, requirementFidelity and uncertaintyHandling. On `banner-title` the two tie: both name the same file and value, and both miss the same two uncertainties, because the change is small enough that retrieval adds nothing. Retrieval-only latency 7 to 32 s and 1.2 to 4.8k output tokens, against 5 to 18 s and 0.7 to 2.9k for ContextLayer; retrieval candidates 2 to 4 per case, recall 1 except `password-reset` (0.67, misses `mail/send.ts`).

- **Limits:** the first table comes from a run where the same model generated and judged, and the judge cannot inspect the repository, so scores are inflated and the gap is directional only. Four fixtures. The two older tables and the model comparison use the title-only baseline, which the four-way run supersedes; they cover four cases, the four-way run six. Both models are from the same vendor.
- **To finish:** (1) done 2026-10-24 with a repository-grounded judge, though both models are from the same vendor; (2) done 2026-10-27: the four-way run reports the retrieval-only baseline beside the floor and ContextLayer; (3) `pnpm review:export`, have a developer score the 12 drafts blind, then `pnpm review:report` (E3); (4) done 2026-10-24: nine fixtures, including a Jira-issue audit, a duplicate ticket, imported copy behind a `tsconfig` alias, a multi-paragraph request and a prompt-injection file. The automated run over the new cases is still to do.

## E3: Blind reviewer comparison (planned)

- **Tests:** H2, H3.
- **Method:** 3 developers or tech leads each receive 10 anonymised tickets (original, generic AI, retrieval-only, ContextLayer) for repositories they know, rank them, mark any claim they believe is wrong, and say which they would start work from. `pnpm review:export` builds the packets from the last `pnpm eval` run with A/B/C/D labels and keeps the mapping in `tests/evaluation/results/blind-key.json`; `pnpm review:report` writes the scoring table to `e3-blind-review.md`. The retrieval-only draft saw the same repository excerpts as ContextLayer, so human scoring isolates its claim statuses and citations instead of rewarding retrieval alone.
- **Success:** ContextLayer ranked first in at least 7 of 10 cases and at most one wrong claim per 10 drafts.
- **Kill:** generic AI ranked first or tied in more than 3 of 10.

## E4: Customer discovery interviews (planned)

- **Tests:** H1, H4, H5, H6.
- **Method:** 8 to 12 interviews following [`customer-discovery.md`](customer-discovery.md).
- **Success:** at least 6 interviewees describe a recent concrete case of costly vague tickets (H1) and at least half would connect the integrations to try it (H4).

## E5: Concierge pilot (planned)

- **Tests:** H1, H2, H6, H7, H9.
- **Method:** 2 to 3 teams connect a real repository and Jira project for 3 weeks. Track analyses created, drafts edited before publishing, published tickets, time to start-ready, and a weekly 5-question survey.
- **Success:** unprompted use in week 3; median edit distance small enough that users call the draft "mostly right"; at least one team asks to keep it.

## E6: Retrieval recall on real repositories (done 2026-10-28, target met with an agent)

- **Tests:** H8.
- **Method:** `pnpm eval tests/evaluation/recall.eval.ts` runs production retrieval over every committed case and writes `results/<case>.recall.json`: an evidence agent reads the repository through tools (list, search, read) and names the files to cite, with no keyword fallback: when the agent fails, the analysis fails and can be re-run. Six cases read this repository at a pinned commit (323 files); the rest are small copied repositories. A case declares the files a good ticket must touch, and the eval records which of them the run missed.
- **Result before the agent (2026-10-28, keyword retrieval, generator `deepseek-flash`, 21 cases):** 37 of 51 expected files retrieved (73%). Expansion costs about 300 input and 210 output tokens per case and changed the outcome twice in each direction: it found `src/features/integrations/connections.ts` and `src/app/(app)/projects/page.tsx`, and it lost `src/infrastructure/db/schema/app.ts` and `src/app/(app)/projects/[projectId]/page.tsx` that the keyword path had found. The two extra files are the new `remove-quoted-value` case, which pins a failure seen on a real run: the request quoted the value to remove, the file holding that value (`sections.ts` in a portfolio's content config) never reached the model, and the draft kept the badge.

| Case                     | Recall | Missed                                                                     |
| ------------------------ | ------ | -------------------------------------------------------------------------- |
| repo-analysis-candidates | 0.25   | `ticket-creation/actions.ts`, `analysis/run.ts`, `db/schema/app.ts`        |
| repo-daily-cap           | 0.00   | `analysis/run.ts`, `ticket-creation/actions.ts`, `infrastructure/env.ts`   |
| repo-dark-mode           | 0.33   | `app/layout.tsx`, `app/(app)/layout.tsx`                                   |
| repo-disconnect-impact   | 0.33   | `integrations/actions.ts`, `components/integrations/disconnect-button.tsx` |
| repo-progress-count      | 0.00   | `projects/[projectId]/page.tsx`, `projects/queries.ts`                     |
| repo-project-search      | 0.50   | `projects/queries.ts`                                                      |
| password-reset           | 0.67   | `mail/send.ts` (three-file fixture, missed with and without expansion)     |

The other 13 cases retrieved every expected file. The expansion pays for itself nowhere: it is net zero on this set, so the recall gap is a ranking problem (docs, `TODO-*.md` and `DECISIONS.md` match request words in their paths and content), not a vocabulary problem.

- **Result with the evidence agent (2026-10-28, `deepseek-flash`, 21 cases):** 48 of 51 expected files (94%), **target met**. The agent costs 2 to 38k input and 0.6 to 1.8k output tokens per case (about $0.001 to $0.007 at list price) and 9 to 15 s. The selection is not deterministic: three runs scored 48, 50 and 48 files, and which files are missed moves between them (this run: `repo-analysis-candidates` missed `ticket-creation/actions.ts` and `db/schema/app.ts`; `repo-daily-cap` missed `infrastructure/env.ts`) — read the range, not the decimal.

- **Limits:** the "real repository" cases are this project, whose docs share the product's vocabulary with the requests; a pilot repository and a developer-written file list (the original method) are still missing. Six cases is small, and the pinned commit ages.
- **Success:** at least 90% recall — keyword retrieval reached 71%, the evidence agent 94% — **met**. The remaining two misses are files the agent did not open, which a stronger reading strategy (or a larger step budget) addresses before a vector index does.

## E7: Judged run of the 2026-11-15 cases and checks (done 2026-11-16)

- **Tests:** whether the fixtures and literal markers added on 2026-11-15 reject correct drafts, and how the three judged suites stand.
- **Method:** `pnpm eval tests/evaluation/analysis.eval.ts tests/evaluation/clarification.eval.ts tests/evaluation/injection.eval.ts`; 19 cases, 23 tests. Two runs with generator `deepseek-flash`: run 1 with no `AI_JUDGE_MODEL`, so the generator judged its own drafts (9 minutes); run 2 with judge `deepseek-v4-pro` (16 minutes), after the changes below. Each failure was read against the saved draft or the run log.
- **The 2026-11-15 checks (run 1):** `appliedAnswers`, `rejectedAnswers`, the answered-question check and the injection phrase check passed on every case; no draft repeated `CEO`, `unlimited` or the injected phrase. Two checks rejected correct drafts and were loosened:
  - `mustNotContain` on an audit read the summary and findings, so `audit-injected-ticket` failed for a finding that named `finance@corp.test` in order to flag it as untrusted. It now reads only the proposed ticket.
  - the `renamed-refund` check banned the old file and function names in the proposed description, which failed a proposal that targeted `src/payments/refunds.ts` and said the old path was gone. It now reads the proposed title and acceptance criteria.
- **Scoring change (between the runs):** an uncertain point the draft never raises no longer fails a case. It is an omission, not an error, and is recorded as `verdict.uncertaintyCoverage` (`raised` / `total`) in the result file. Forbidden claims, settled uncertainties, missing facts and contradicted claims still fail.
- **Result:** run 1 passed 2 of 23 (self-judged, before the changes). Run 2 passed 5 of 23: `audit-renamed-refund`, `export-orders-csv`, `large-pricing-rules`, `multi-paragraph-request` and `prompt-injection` in the analysis suite. Retrieval recall is 1 on all 19 cases in both runs. Uncertainty coverage in run 2, over the 12 cases whose last draft reached the judge: 20 of 29 points raised.
- **Run 2 failures by first failing assertion:**

| Cause                                                                                            | Tests | Cases                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Judge: a point that must stay open is settled, or a claim is forbidden                           | 9     | `ambiguous-export-fix`, `audit-injected-ticket` (both suites), `audit-orders-page-size`, `audit-stock-badge`, `audit-vague-search`, `banner-title`, `slow-dashboard`, `prompt-injection` (injection suite) |
| Validator issue: a claim quotes text outside its evidence, or settles what an open question asks | 8     | `audit-existing-dark-mode`, `checkout-accessibility`, `code-comment-injection` (both suites), `password-reset`, `duplicate-export-request`, `dupliquer-facture`, `banner-title` (injection suite)          |
| A relevant file read but not cited                                                               | 1     | `stale-ticket-audit` (`src/cart/CartTotal.tsx`)                                                                                                                                                            |

- **Reading:** the dominant failure is a draft that decides a point the fixture says no source can settle (the CSV columns, per-key rate limiting, a page size of 100), usually in an acceptance criterion. Some of these verdicts are strict: `banner-title` fails for "the subtitle remains unchanged", and `audit-injected-ticket` in the analysis suite for quoting the injected address in a finding that flags it. `prompt-injection` passed in one suite and failed in the other on a different draft of the same case.
- **Run 3 (stronger generator):** generator `deepseek-v4-pro`, judge `deepseek-flash`, 21 minutes. 3 of 23 pass (`large-pricing-rules`, `password-reset`, `slow-dashboard`), so the stronger generator does not help. First failing assertion: 9 validator issues, 8 judge verdicts, 2 relevant files not cited (`stale-ticket-audit`, `banner-title`), 1 `mustNotContain` (`audit-injected-ticket`, the address inside the proposed ticket this time). The same shapes recur as with Flash: a Verified claim with a quote its evidence lacks, a criterion stating a value an open question asks (`429`, `10`), and a draft deciding an open point (the CSV columns, closing a ticket as a duplicate). Two things to check before blaming the drafts: the validator flagged the quoted strings `"e1"`, `"pagesize"` and a ticket phrase as evidence quotes, which suggests its quote check also catches quotes that are not citations; and the Flash judge counted injected text inside an evidence excerpt as a forbidden claim on `code-comment-injection`, which is a judge error.
- **Validator check (2026-11-17, no model calls):** replaying `src/core/evidence/validate.ts` over the run 3 drafts showed four false-positive patterns, now fixed: a double quote inside a backticked snippet split it into fragments; an escaped quote (`\"`) cut a quoted string short; a quoted evidence id (`id="e1"`) was checked as text from the evidence; and the open-question check matched inside larger numbers and words ("10" in "1024", "Pay" in "Payment"). After the fix the same drafts carry 5 issues instead of 13, and `ambiguous-export-fix`, `audit-renamed-refund` and `audit-stock-badge` no longer stop at the validator (they were not re-judged). The 5 left: two Verified claims citing no evidence (`banner-title`, `duplicate-export-request`, both sourced from the request rather than the repository), a Verified claim that quotes `pageSize` to say the parameter does not exist (the check cannot read a negation), a claim reporting the injected "50 MB" comment, and a criterion that names 429 "for example" while marked as needing a decision. The last two are non-blocking warnings and match the check's intent.
- **Limits:** one run per configuration, both models from the same vendor. The product default (`anthropic/claude-sonnet-5.5`) was not run: the local key is a DeepSeek key and the Vercel AI Gateway refuses that model on the free tier. A test stops at its first failed assertion, so a case listed under a validator issue was not judged. Results vary between runs, so a single pass or fail on one case is weak evidence.
