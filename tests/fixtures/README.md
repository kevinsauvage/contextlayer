## Evaluation fixtures

`tests/fixtures/<case>/` holds a `case.json` and a mini `repo/`. Rubric: `docs/product/evaluation-rubric.md`.

### case.json

| Field           | Meaning                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| `id`            | Matches the directory name.                                                                                 |
| `kind`          | `create` (default) drafts a ticket from `request`; `audit` critiques the `issue`.                           |
| `title`         | Short label, and the whole request when `request` is absent.                                                |
| `request`       | The full create request, for cases longer than one line.                                                    |
| `issue`         | The Jira issue to audit (`kind: "audit"`): key, summary, description, status, url.                          |
| `relatedIssues` | Issues the tracker already holds, so retrieval can surface a duplicate.                                     |
| `answers`       | Answers (`{ question, answer }`) and follow-ups (`{ message }`) replayed as an earlier clarification round. |
| `tags`          | Used to select subsets: `injection` and `control` make up the nightly eval.                                 |
| `expected`      | `relevantFiles`, `verifiedFacts`, `mustStayUncertain`, `forbiddenClaims`, and `appliedAnswers` markers.     |

`relevantFiles` are paths relative to the case directory (`repo/src/...`). An empty `answer` means the question stays open. `appliedAnswers` are case-insensitive substrings a good draft must contain once its answers are applied.
