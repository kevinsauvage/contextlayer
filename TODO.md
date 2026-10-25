# TODO

Open work only; shipped work lives in `git log` and `DECISIONS.md`. Last reviewed 2026-10-24.

The backlog is split by kind of work, one `TODO-<KIND>.md` file each. Add a new kind only when none fits, following the same pattern.

| File                                   | Kind of work                                                      |
| -------------------------------------- | ----------------------------------------------------------------- |
| [`TODO-BUG.md`](TODO-BUG.md)           | Code: existing behaviour that is wrong or silently incomplete     |
| [`TODO-FEATURE.md`](TODO-FEATURE.md)   | Code: new application behaviour                                   |
| [`TODO-QUALITY.md`](TODO-QUALITY.md)   | Code: tests, evals and fixtures                                   |
| [`TODO-NON-CODE.md`](TODO-NON-CODE.md) | No code: research, decisions, manual reviews, config, docs, infra |

Each item has a **Context** (why it matters) and a **Fix** (how to close it), and carries its priority tag.

**Markers** `[ ]` open · `[~]` partly done · **Tags** `P#` priority · `C#` [Phase 0 criterion](docs/product/phase-0-decision.md) · `E#` [experiment](docs/product/validation-experiments.md) · `H#` [hypothesis](docs/product/business-hypotheses.md)

## At a glance

| Priority | Goal                                                              | Bug | Feature | Quality | Non-code |
| -------- | ----------------------------------------------------------------- | --: | ------: | ------: | -------: |
| P0       | Decide whether to build (evidence for the go / pivot / stop rule) |   0 |       0 |       0 |        3 |
| P1       | Prove the product (quality, retrieval, cost)                      |   0 |       4 |       0 |        2 |
| P2       | Connect and deliver (real teams, real credentials)                |   0 |       5 |       0 |        2 |
| P3       | Harden and validate (security, operations, pilot)                 |   0 |       6 |       1 |        5 |

**Phase 0 unblockers:** C1 ← E4 interviews · C2 ← E3 blind scoring · C3 ← fixtures and forbidden-claim checks.
