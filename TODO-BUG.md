# TODO · Bugs

## P2 · Production-grade: limits

- [~] **Enforce the deployment-wide daily analysis cap under concurrency** `P2`
  - **Context:** before the correction, `claimRun` locked by user, then counted deployment-wide runs before inserting the new run. Requests from different users could pass the same total count concurrently and exceed `ANALYSIS_TOTAL_PER_DAY` (`src/features/analysis/limits.ts`).
  - **Done:** `claimRun` now takes a shared transaction-scoped advisory lock before checking limits and recording a run, so concurrent claims across users cannot pass the same deployment-wide count.
  - **Remaining:** add a database integration test that races claims from different users at the deployment cap.
