# TODO · Bugs

Existing behaviour that is wrong: it fails, or silently returns incomplete or incorrect results. Index and conventions: [`TODO.md`](TODO.md).

## P1 · Prove the product

- [~] **The analysis does not record which commit it read** `P1`
  - **Context:** `GithubSource.connect` now pins the repository's default branch to its commit SHA, and `getTree`, `readFile` and `urlFor` all use it, so a published link keeps showing the lines it was verified against and one run cannot mix commits. The revision is not stored on the analysis, so a re-run cannot compare it with the previous one and tell the user the code changed since the draft was built.
  - **Fix:** expose the revision on `ContextSource`, carry it through `draftTicket` / `auditIssue` with the outcome, and store it on `analysis`. On a re-run, compare the new revision with the stored one and surface the difference where the draft is shown.
