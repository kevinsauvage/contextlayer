Strengthen the evaluation suite. Don't run `pnpm eval` (it costs tokens) unless I say so.

1. Read `docs/product/evaluation-rubric.md`, `tests/evaluation/*.ts`, `tests/fixtures/README.md` and the latest files in `tests/evaluation/results`.
2. Map what's covered: for each eval (analysis, baseline, clarification, injection, recall) list the fixtures and the behaviours it scores. Then list gaps against the rubric and the product promise in `PRODUCT.md`, for example: requests that should end in `needs_clarification`, tickets citing files that don't exist, multi-file changes, renamed symbols, very large files, non-English requests, injection hidden in code comments or Jira comments.
3. Propose the 3–5 highest-value new cases with why each matters. Then add them as fixtures following `tests/fixtures/README.md`, with expected outcomes precise enough to score automatically (files that must be cited, statuses that must appear, things that must not happen).
4. Check the scoring code (`judge.ts`, `draft-case.ts`) for ways a wrong answer can still pass: lenient matching, missing negative checks, judge prompts that read untrusted text as instructions. Fix what's cheap; file the rest in `TODO-QUALITY.md`.
5. Run `pnpm check` (it doesn't run evals).

Reply with the coverage map, the cases added and the command to run only them.
