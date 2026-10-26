## Evaluation fixtures

`tests/fixtures/<case>/` holds a `case.json` and a mini `repo/`. Rubric: `docs/product/evaluation-rubric.md`.

### case.json

| Field           | Meaning                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `id`            | Matches the directory name.                                                                                               |
| `kind`          | `create` (default) drafts a ticket from `request`; `audit` critiques the `issue`; `retrieval` only measures what retrieval finds. |
| `title`         | Short label, and the whole request when `request` is absent.                                                              |
| `request`       | The full create request, for cases longer than one line.                                                                  |
| `issue`         | The Jira issue to audit (`kind: "audit"`): key, summary, description, status, url.                                        |
| `relatedIssues` | Issues the tracker already holds, so retrieval can surface a duplicate.                                                   |
| `answers`       | Answers (`{ question, answer }`) and follow-ups (`{ message }`) replayed as an earlier clarification round.               |
| `repository`    | `{ root, commit }`: read a checkout at a pinned commit instead of a copied `repo/` directory.                             |
| `tags`          | Used to select subsets: `injection` and `control` make up the nightly eval.                                               |
| `expected`      | `relevantFiles`, `verifiedFacts`, `mustStayUncertain`, `forbiddenClaims`, `appliedAnswers`, `knownMisses`.                |

`relevantFiles` are paths relative to the `repo/` root (`repo/src/...`). An empty `answer` means the question stays open. `appliedAnswers` are case-insensitive substrings a good draft must contain once its answers are applied.

`knownMisses` are the `relevantFiles` retrieval does not find without a model. `tests/unit/fixture-recall.test.ts` fails on any other miss, so finding one of them means updating the list.

### Large checkouts

A `retrieval` case reads this repository at a pinned commit (`repository`), so the whole codebase exercises the same retrieval as production, on the same tree every run. It never reaches the judge, so it only carries `relevantFiles` and `knownMisses`, and no expected draft.

`pnpm eval tests/evaluation/recall.eval.ts` measures every case with the query expansion production runs and writes `results/<case>.recall.json`. Record the measured recall in `docs/product/validation-experiments.md` (E6).
