# Evaluation rubric

Score each draft 0–2 per criterion (0 = fails, 1 = partial, 2 = good). Compare: original ticket, generic-AI baseline, ContextLayer. A developer or tech lead reviews; record failures too.

| Criterion             | Question                                                |
| --------------------- | ------------------------------------------------------- |
| Factual correctness   | Are technical claims supported by the project?          |
| Evidence traceability | Can a reader inspect the source of each relevant claim? |
| Requirement fidelity  | Does it avoid inventing business intent?                |
| Actionability         | Can a developer understand the task?                    |
| Acceptance criteria   | Clear and testable? Product decisions marked?           |
| Uncertainty handling  | Are material unknowns exposed?                          |
| Relevance             | Does retrieved context relate to the task?              |
| Efficiency            | Latency and cost per analysis (record, not scored)      |

## How scoring is done

- **Automated (directional):** `pnpm eval tests/evaluation/baseline.eval.ts` has an LLM judge score the original ticket, a generic AI answer and the ContextLayer draft against the fixture ground truth (`verifiedFacts`, `mustStayUncertain`, `forbiddenClaims`). It scores the first six criteria, 0 to 2 each, max 12. The judge is `AI_JUDGE_MODEL` and cannot read the repository; when that is unset it falls back to `AI_MODEL`, the run warns, and the result file records `judgeIsGenerator`.
- **Human (authoritative):** a developer or tech lead scores the same drafts blind to their source, using the table above. Human scores override the judge. `pnpm review:export` writes `tests/evaluation/review/<case>.md` packets (drafts labelled A-C, source hidden) and a score template; fill `scores.json`, then `pnpm review:report` writes `docs/product/e3-blind-review.md` with the human totals next to the judge's.
- **Efficiency** is read from `latencyMs` and `usage` in the result files.

## Latest results

See experiment E2 in [`validation-experiments.md`](validation-experiments.md). Automated only, same-model judge (DeepSeek), four fixtures; the separate-judge rerun and the blind human pass are pending.
