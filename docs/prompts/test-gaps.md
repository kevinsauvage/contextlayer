Close the most valuable test gaps.

1. Run `pnpm test:coverage` and read the summary only (not the HTML). List the files under `src/core` and `src/features` with the lowest branch coverage, weighted by how much product risk they carry (evidence validation, retrieval, analysis, approval-gated Jira writes rank highest).
2. Pick up to 5 functions. For each, write the cases that matter: happy path, the edge cases a real repo or Jira ticket produces, and the failure the function exists to prevent. Follow the existing style in `tests/unit` and reuse `tests/helpers`, `tests/stubs` and `tests/fixtures` instead of building new mocks.
3. Test behaviour through the public function, not internals. No snapshot tests of large objects. No tests that only restate the implementation.
4. If a test exposes a bug, keep the failing test as `it.fails` or `it.todo`, file the bug in `TODO-BUG.md` and move on; don't fix product code in this run.
5. Run the new files with `pnpm test tests/unit/<file>`, then `pnpm check`.

Reply with coverage before and after for the touched files, the tests added, and any bugs filed.
