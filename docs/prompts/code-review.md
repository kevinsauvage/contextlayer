Review code in this repo. Don't edit source files.

Target: the diff of the last 5 commits (`git diff HEAD~5`) plus any uncommitted changes, unless I give a path or commit range after this prompt.

Check, in this order, and only report what you can point to in the code:

1. **Correctness:** logic errors, unhandled `undefined`, wrong error paths, race conditions in server actions, missing `await`, stale data after mutations.
2. **Trust rules:** external data and AI output validated with Zod and then `src/core/evidence/validate.ts`; no claim marked `verified` without evidence; repo, doc and Jira text never able to override instructions; Jira writes only after explicit approval.
3. **Architecture:** `app` → `features` → `core` direction, `core` free of I/O, route handlers thin, `integrations` implementing `core` interfaces. Run `pnpm deps:check`.
4. **Tenant isolation:** every query that reads or writes org data is scoped to the caller's organization and checks their role.
5. **Quality:** duplication, types redeclared instead of `z.infer`, hand-written code a maintained package covers, dead code, comments that restate the code.
6. **Tests:** changed behaviour without a test that would catch a regression.

For each finding give `file:line`, the concrete failure scenario (input → wrong result), severity (high / medium / low) and the fix. Drop anything you can't back with a scenario. Then ask whether to file the findings in the matching `TODO-<KIND>.md` files or fix them now.
