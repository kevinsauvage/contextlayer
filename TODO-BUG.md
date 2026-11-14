# TODO · Bugs

Existing behaviour that is wrong: it fails, or silently returns incomplete or incorrect results. Index and conventions: [`TODO.md`](TODO.md). Items from the 2026-10-26 review cite its finding id (for example `B1`) in [`docs/engineering/project-audit-2026-10-26.md`](docs/engineering/project-audit-2026-10-26.md). Items from the 2026-11-02 code review and prompt run (`docs/prompts/`) were found by reading the code and the installed library sources; none was reproduced in a running app unless the item says so.

Items from the 2026-11-14 code review were found by reading the code; only the redaction cases were reproduced (in a throwaway unit test).

## P2 · Production-grade: security, limits, deploy, reliability

- [ ] **Refinements and retries are not counted by the run limits** `P2`
  - **Context:** `assertRunAllowed` (`src/features/analysis/limits.ts:27`) counts `analysis` rows by `createdAt`, but `restartAnalysis` (`src/features/analysis/run.ts:119`) re-runs a row in place: no row is added and `createdAt` does not move. One analysis can therefore be refined or retried without bound, each time a full agent exploration plus a draft, and only the "already running" guard slows it down. The per-minute, per-user and deployment-wide budgets do not see any of it.
  - **Fix:** record every run where the limits can count it: either an `analysis_run` table (analysis id, user id, started at) written by both `startAnalysis` and `restartAnalysis`, or a per-user daily counter row. Count from that in `assertRunAllowed`, keep the three limits, and add an integration test that a redraft at the limit returns `AnalysisLimitError`. Record the choice in `DECISIONS.md`.

- [ ] **Secret redaction masks ordinary code and misses common secret shapes** `P2`
  - **Context:** the `ASSIGNMENT` pattern in `src/core/context/redact.ts:13` treats any key containing `password`, `secret`, `token` or `key` followed by six non-space characters as a credential. It masks code the ticket needs as evidence: `const token = getToken();`, `const accessToken = session.accessToken;`, `export const API_KEY = process.env.API_KEY;` and `passwordField: z.string().min(10),` all become `[redacted]`, so a draft about auth code cites lines the model never saw. It also misses real secrets: a quoted value with a space (`password = "my pass word"`), credentials inside a URL (`DATABASE_URL=postgres://user:hunter22@host/db`) and `Authorization: Bearer …` headers pass through unchanged.
  - **Fix:** skip values that are clearly expressions (contain `(`, `.` member access on an identifier, `process.env`, or start with an identifier followed by `(`/`.`), add patterns for URL userinfo (`://user:pass@`) and `Bearer <token>`, and let a quoted value contain spaces. Add each case above to `tests/unit/redact.test.ts`, and run the retrieval fixtures to confirm no cited excerpt loses lines it needs.

## P3 · Later: optional features and deeper hardening

- [ ] **A code-search term can carry GitHub search qualifiers** `P3`
  - **Context:** `GithubSource.searchContent` builds `q` as `${term} repo:owner/name` (`src/integrations/github/source.ts:173`) with the term written by the model, and file contents are untrusted. A term such as `x repo:owner/other` adds a second repository to the query; results are filtered by path only, so paths from another repository the same installation can read could reach the agent. File contents cannot leak this way, because `readFile` only accepts paths the pinned tree lists. Not reproduced against GitHub.
  - **Fix:** drop terms that contain a qualifier (`/\b[a-z]+:/i`) or whitespace in `searchableTerms` (`src/integrations/source-filters.ts`), reporting them through `skippedTerms`, and keep only items whose `repository.full_name` matches the project's repository. Extend `tests/unit/github-source.test.ts`.

- [ ] **The member-role rules are only enforced in the page** `P3`
  - **Context:** `canChangeMemberRole` and `canRemoveMember` (`src/core/organizations/roles.ts:20`) say an admin manages members only, but they are called only from `src/app/(app)/settings/organization/page.tsx` to hide buttons. `updateMemberRole` and `removeMember` (`src/features/organizations/actions.ts:107`, `:117`) check `requireOrgAdmin()` and then defer to Better Auth, whose default admin role may change another admin. A direct action call can do what the page hides. Better Auth's defaults were not verified here.
  - **Fix:** in both actions, load the target member row in the caller's organization and return the existing "Only organization owners and admins can do this" error unless the matching `can…` rule passes; add cases to `tests/integration/actions.test.ts` for an admin targeting an admin and an owner.

- [ ] **The run-limit check and the insert are not atomic** `P3`
  - **Context:** `startAnalysis` counts, then inserts (`src/features/analysis/run.ts`), so parallel requests from one user can each pass the count and exceed the per-minute or daily limit by the number of requests in flight.
  - **Fix:** take a per-user advisory lock (`pg_advisory_xact_lock(hashtext(userId))`) around the count and the insert in one transaction, or fold this into the run-counter table from the P2 item above.

- [ ] **Edited drafts from the browser have no size bounds** `P3`
  - **Context:** `saveDraftEdits` and `publishTicket` validate the browser's draft with `draftBodySchema` (`src/core/requirements/schemas.ts:43`), whose arrays and `claimSchema.text` (`src/core/evidence/schemas.ts:39`) have no maximum. A member can store a draft up to the Server Action body limit in `editedResult`, and a published one is refused by Jira only after the request is sent (description limit 32,767 characters).
  - **Fix:** parse browser input with a bounded variant (for example 50 items per list, 2,000 characters per text) while the model-output schema stays as it is, and return a clear message when the rendered description would exceed Jira's limit.
