# Phase 0 decision

Question: is this worth building into a product? Status: **open**. The prototype exists, but the evidence needed to decide is mostly missing. This file fixes the criteria in advance so the outcome cannot be rationalised afterwards.

## Decision criteria

| #   | Criterion                                                             | Evidence needed                                   | Current evidence                                                                                                                        | Met?    |
| --- | --------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| C1  | The problem is real and costly for a defined user (H1, H5)            | E4: at least 6 of 8 to 12 interviews              | None                                                                                                                                    | No      |
| C2  | Output is clearly better than generic AI and the original ticket (H2) | E2 finished and E3: ContextLayer first in 7 of 10 | E2 with a separate, repository-grounded judge: 45 vs 12 vs 11 of 48, same vendor, 4 fixtures; E3 pending                                | Not yet |
| C3  | No fabricated claim survives validation on the fixtures               | Forbidden-claim checks on 8 to 10 fixtures        | Evidence references validated; forbidden claims not yet checked automatically                                                           | Not yet |
| C4  | Integrations are feasible and acceptable (H4)                         | Feasibility notes and interviews                  | Feasible: GitHub App and Jira OAuth work in the prototype ([`feasibility`](../engineering/phase-0-feasibility.md)); acceptance untested | Partly  |
| C5  | Cost and latency are viable (H7)                                      | Cost per analysis from the `analysis` table       | 8 to 20 s, 1 to 3k tokens per analysis on DeepSeek; cost now recorded per run from list prices (`analysis.cost_usd`)                    | Partly  |
| C6  | A differentiator remains against platform features (H6)               | Hands-on competitor comparison, interviews        | First-pass desk research only ([`competitor-research.md`](competitor-research.md))                                                      | No      |

## Rule

- **Go** to Phase 1 and 2 hardening and a pilot when C1 to C3 are met and C4 to C6 are at least partly met.
- **Pivot or stop** if C1 fails (no owner or no pain) or C2 fails (reviewers do not prefer the output). Possible pivots: audit-only wedge (H9), an agent-facing evidence API, or a Jira app aimed at a different role.
- Review the table after E3 and E4, and after each batch of four interviews.

## Decision log

| Date | Decision | Reason |
| ---- | -------- | ------ |
|      |          |        |
