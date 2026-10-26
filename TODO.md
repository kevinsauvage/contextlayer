# TODO

Open work only; shipped work lives in `git log` and `DECISIONS.md`. Last reviewed 2026-10-26.

The backlog is split by kind of work, one `TODO-<KIND>.md` file each. Add a new kind only when none fits, following the same pattern.

| File                                   | Kind of work                                                      |
| -------------------------------------- | ----------------------------------------------------------------- |
| [`TODO-BUG.md`](TODO-BUG.md)           | Code: existing behaviour that is wrong or silently incomplete     |
| [`TODO-FEATURE.md`](TODO-FEATURE.md)   | Code: new application behaviour                                   |
| [`TODO-QUALITY.md`](TODO-QUALITY.md)   | Code: tests, evals and fixtures                                   |
| [`TODO-REFACTOR.md`](TODO-REFACTOR.md) | Code: structure and cleanup that change no behaviour              |
| [`TODO-NON-CODE.md`](TODO-NON-CODE.md) | No code: research, decisions, manual reviews, config, docs, infra |

Each item has a **Context** (why it matters) and a **Fix** (how to close it), and carries its priority tag.

**Markers** `[ ]` open · `[~]` partly done · **Tags** `P#` priority (`Deferred`: kept for later, not scheduled) · `C#` [Phase 0 criterion](docs/product/phase-0-decision.md) · `E#` [experiment](docs/product/validation-experiments.md) · `H#` [hypothesis](docs/product/business-hypotheses.md) · `B#` [finding in the 2026-10-26 audit](docs/engineering/project-audit-2026-10-26.md)

## At a glance

| Priority | Goal                                                                             | Bug | Feature | Quality | Refactor | Non-code |
| -------- | -------------------------------------------------------------------------------- | --: | ------: | ------: | -------: | -------: |
| P0       | Core promise: the draft must be correct and the run must not fail                |   0 |       0 |       0 |        0 |        0 |
| P1       | Prove it: fair evaluation, real retrieval measurements, correctness fixes        |   0 |       0 |       2 |        0 |        1 |
| P2       | Production-grade: security, limits, deploy, reliability                          |   0 |       6 |       1 |        2 |        7 |
| P3       | Polish and later                                                                 |   2 |       7 |       0 |        4 |        6 |
| Deferred | Business validation and the demo clone, not needed to build the product properly |   0 |       1 |       0 |        0 |        5 |

**Order of work:** P0 first (the core promise), then P1 (prove it), then P2 (production-grade; do the migration squash and dependency fixes before the production database exists). Rationale in [`docs/engineering/project-audit-2026-10-26.md`](docs/engineering/project-audit-2026-10-26.md), section 6.
