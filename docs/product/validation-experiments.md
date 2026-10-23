# Validation experiments

Each experiment tests one or more hypotheses from [`business-hypotheses.md`](business-hypotheses.md). Status: **planned**, **running**, **done**.

## E1: Pipeline sanity (done)

- **Tests:** feasibility of H2, H8.
- **Method:** `pnpm eval` on 4 fixtures with Gemini 3.8 Flash (free tier).
- **Result (2026-10-22):** 4 of 4 drafts passed evidence-reference validation (forbidden claims are not checked automatically yet); keyword retrieval found 9 of 10 expected files (misses `mail/send.ts` for "Add password reset").
- **Limit:** 4 fixtures written by the builder; not representative.

## E2: Baseline comparison (done, directional)

- **Tests:** H2, H7.
- **Method:** `tests/evaluation/baseline.eval.ts` scores three versions of each ticket (the original title, a generic AI answer from the title alone, the ContextLayer draft) 0 to 2 on six rubric criteria (max 12), using an LLM judge with the fixture ground truth. Model: DeepSeek (`deepseek-flash`), JSON mode.
- **Result (2026-10-23):**

| Case                   | Original | Generic AI | ContextLayer |
| ---------------------- | -------- | ---------- | ------------ |
| checkout-accessibility | 2        | 3          | 11           |
| export-orders-csv      | 2        | 6          | 11           |
| password-reset         | 0        | 5          | 12           |
| slow-dashboard         | 2        | 8          | 12           |

Latency 8 to 20 s for both approaches; output tokens 1.1 to 2.8k for both.

- **Limits:** the same model generated and judged, and the judge cannot inspect the repository, so scores are inflated and the gap is directional only. Four fixtures.
- **To finish:** (1) judge with a different model, (2) a developer scores the 12 drafts blind to the source, (3) grow to 8 to 10 fixtures including a Jira-issue and a duplicate-ticket case.

## E3: Blind reviewer comparison (planned)

- **Tests:** H2, H3.
- **Method:** 3 developers or tech leads each receive 10 anonymised tickets (original, generic AI, ContextLayer) for repositories they know, rank them, mark any claim they believe is wrong, and say which they would start work from.
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

## E6: Retrieval recall on real repositories (planned)

- **Tests:** H8.
- **Method:** on each pilot repository, a developer lists the files a ticket should touch for 10 past tickets; compare with `retrievalRecall`.
- **Success:** at least 90% recall after LLM query expansion. If not, prototype embeddings behind the `ContextSource` interface and re-measure.
