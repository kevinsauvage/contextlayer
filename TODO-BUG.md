# TODO · Bugs

Existing behaviour that is wrong: it fails, or silently returns incomplete or incorrect results. Index and conventions: [`TODO.md`](TODO.md). Items from the 2026-10-26 review cite its finding id (for example `B1`) in [`docs/engineering/project-audit-2026-10-26.md`](docs/engineering/project-audit-2026-10-26.md). Items from the 2026-11-02 code review were found by reading the code and the installed library sources; none was reproduced in a running app.

## P1 · Prove it: correctness fixes

- [ ] **A network error on a Jira write can create the issue twice** `P1`
  - **Context:** `jiraRequest` in `src/integrations/jira/client.ts` retries `post` and `put`, meant for 429s only. ky 2 also retries network errors (`fetch failed`, a connection reset) for every method in that list (`node_modules/ky/readme.md`, "Network errors … are automatically retried for retriable methods"). If the connection drops after Jira created the issue, ky posts it again within the same request, so the claim in `publishApproved` cannot prevent a duplicate.
  - **Fix:** keep `methods` to `get` for network errors, and use `shouldRetry` so `post`/`put` retry only on an `HTTPError` with status 429. Add a `jira-client` unit test where the first `POST /issue` fails with `TypeError("fetch failed")` and assert a single call and a thrown error.

- [ ] **GitHub code search is rate limited and failures read as "no match"** `P1`
  - **Context:** the evidence agent can call `searchContent` on every step (`MAX_STEPS = 8`), and `GithubSource.searchContent` runs up to 3 code searches per call. GitHub allows 10 code searches a minute per installation, shared by concurrent analyses. A failed search is logged and dropped (`src/integrations/github/source.ts:106`), so the agent receives `[]` and concludes the term is absent. Retrieval then gets worse with no sign on the analysis.
  - **Fix:** have `searchContent` report a failure (a result such as `"Search unavailable (rate limited); use listFiles with contains"`) instead of an empty list, cap searches per run, and record the number of failed searches on the run (with "Store the retrieval candidates" in [`TODO-FEATURE.md`](TODO-FEATURE.md)). Then measure a run on a real installation.

## P2 · Polish and evidence

- [ ] **Anyone can sign up with an invitee's address and join the organization** `P2`
  - **Context:** sign-up does not verify email. `/onboarding` lists every pending invitation for the session's email, with links (`listInvitationsForEmail` in `src/app/onboarding/page.tsx`). Better Auth only checks that the email matches, and it skips the verified-email check when invitation ids are opaque, because it treats the id as the secret (`shouldRequireVerifiedEmailForInvitationIdAction` in `node_modules/better-auth/dist/plugins/organization/routes/crud-invites.mjs`). The onboarding list gives that secret to whoever registers the address first. They become a member and can read code excerpts, tickets and publish.
  - **Fix:** now, list invitations on `/onboarding` only when `session.user.emailVerified` is true (so never, until verification exists); the invitation link still works for the real invitee. With "Email verification" in [`TODO-FEATURE.md`](TODO-FEATURE.md), set `requireEmailVerificationOnInvitation: true` in the organization plugin. Add an integration test: an unverified user with the invited email sees no invitation.

- [ ] **A run can outlive the 300 s limit and stay "running" for 10 minutes** `P2`
  - **Context:** the evidence agent may take 90 s (`AGENT_TIMEOUT_MS`) and the generator 120 s per attempt with one retry (`MODEL_TIMEOUT_MS` and `pRetry` in `src/integrations/ai/generator.ts`), which comes to 330 s before any GitHub or Jira call. The pages set `maxDuration = 300`. When the host kills the request, the `catch` in `recordOutcome` never runs. The row reads as running until `STALE_ANALYSIS_MS` (10 min), a re-run is refused, and the page keeps saying "Refresh in a moment".
  - **Fix:** give each run one deadline below `maxDuration` (for example 270 s), pass it as `abortSignal` to both model calls, and skip the generator retry when too little time is left. Derive `STALE_ANALYSIS_MS` from the same constant plus a margin, so a dead run is shown as failed within about 5 minutes.

- [ ] **Autosave can write old edits over a new draft** `P2`
  - **Context:** `saveDraftEdits` (`src/features/ticket-creation/actions.ts:116`) compares `runKey` with `startedAt` in one query and then updates `editedResult` in another, filtered only by id and `publishedIssueKey`. A redraft started between the two (from a second tab, or a queued autosave) clears `editedResult` and starts running, then the old edits land on the row. `readAnalysis` prefers `editedResult`, so when the redraft finishes the page shows the old edits instead of the new draft.
  - **Fix:** make the check part of the update: `where id = ? and run_token = ? and status = 'completed' and published_issue_key is null`, and use `runToken` as the key the page passes instead of `startedAt.toISOString()` (an `eq` on a microsecond Postgres timestamp would not match a millisecond JS date). Add an integration test that runs a restart between the read and the write.

- [ ] **Unexpected run errors are stored and shown verbatim** `P2`
  - **Context:** for any error that `toActionError` does not recognise, `recordOutcome` (`src/features/analysis/run.ts:53`) stores `error.message`, and every member sees it on the analysis page and in the chat (`FailedAlert`, `LatestReply`). Messages from the AI provider, Octokit or Postgres can contain internal URLs, request ids, schema details or model output.
  - **Fix:** store a fixed message for unknown errors ("The analysis failed. Try again; if it keeps failing, contact an admin.") and log the original with the analysis id (see "Error monitoring" in [`TODO-FEATURE.md`](TODO-FEATURE.md)). Keep the known errors' messages.

- [ ] **A hung Atlassian token request holds a row lock and a database connection** `P2`
  - **Context:** `refreshGrant` (`src/features/integrations/access.ts`) locks the grant's rows in a transaction and calls `refreshJiraTokens` inside it. `requestTokens` and `listJiraSites` in `src/integrations/jira/oauth.ts` use `fetch` with no timeout. If Atlassian stops responding, the lock and one of the 10 pooled connections stay held, and every other analysis on that Jira site waits behind it.
  - **Fix:** add `signal: AbortSignal.timeout(15_000)` to both requests (or use the `ky` instance the Jira client already uses, with its timeout), and test that a timeout during a refresh releases the lock.

## P3 · Later: optional features and deeper hardening

- [ ] **The dark theme is unreachable** `P3` `B16`
  - **Context:** nothing sets the `.dark` class, so the dark variables in `src/app/globals.css` and every `dark:` class in `src/components/ui` never apply.
  - **Fix:** add a theme toggle (`next-themes`, with `prefers-color-scheme` as the default). The dark styles already exist, and a public portfolio should show them working. Delete them only if you decide not to offer a dark theme.

- [ ] **Jira permission and missing-issue refusals read as "did not confirm"** `P3`
  - **Context:** `JiraClient.write` maps only a 400 to `TrackerRejectedError`. A 403 (the user cannot create issues in that project) or a 404 (the audited issue was deleted) is a definite refusal. `publishApproved` treats it as possibly written: it keeps the claim for 2 minutes and tells the user to check the tracker before approving again.
  - **Fix:** map 403 and 404 on writes to `TrackerRejectedError` with a plain message ("Jira refused: no permission to create issues in SHOP", "SHOP-12 no longer exists"), and cover both in `jira-client.test.ts`.

- [ ] **Evidence warnings do not follow the user's edits** `P3`
  - **Context:** `DraftWorkspace` shows `analysis.evidenceIssues`, which are computed once when the run finishes. After the user fixes a claim in Edit, the warning stays. A new problem introduced by an edit only appears as an error when they approve (`parseApprovedDraft`).
  - **Fix:** recompute the warnings on the client with `validateEvidenceReferences` and `validateOpenQuestions` from `src/core/evidence/validate.ts` (pure, already shared) against the stored evidence each time the draft changes. Show the stored list only before the first edit.

- [ ] **Excerpt line ranges include the omitted middle of a file** `P3`
  - **Context:** for a long file, `excerptFrom` (`src/core/context/retrieve.ts`) sends the head and tail with the middle cut out, but it returns `lines: { start, end: lines.length }`. The GitHub link and the "Relevant context" line in Jira (`path:start-end`) then cite lines the model never saw.
  - **Fix:** return the head's own range (or both ranges, with the evidence holding a list) and link to the head range. Add a case to `evidence.test.ts`.

- [ ] **History shows only the latest 50 analyses** `P3`
  - **Context:** `listAnalyses` uses `.limit(50)` (`src/features/projects/queries.ts`) and the History tab has no paging, so older analyses cannot be reached.
  - **Fix:** add keyset paging on `(created_at, id)` (the index exists) with a "Show older" link, or say "showing the latest 50" under the list.

- [ ] **Times are shown in the server's time zone** `P3`
  - **Context:** the History tab formats `createdAt` with `toLocaleString("en", …)` in a server component, so a deployed app shows UTC with no zone marker.
  - **Fix:** format in a small client component with the browser's locale and time zone (keep the `<time dateTime>` attribute), or show relative times.

- [ ] **Malformed ids in some actions surface as database errors** `P3`
  - **Context:** `getProject` and `getConnection` reject a non-UUID id with `isUuid`. `deleteProject`, `disconnectConnection` and `projectsUsingConnection` do not, so a bad id from the client reaches Postgres as a cast error (22P02) and shows the error boundary instead of "not found".
  - **Fix:** check `isUuid` (or parse with `z.uuid()`) at the top of those actions, and add the case to `actions.test.ts`.

- [ ] **Related Jira issues with accented text rank too low** `P3`
  - **Context:** `extractTerms` strips accents (`créer` → `creer`), but `JiraClient.searchRelated` scores issues by `summary.toLowerCase().includes(term)` without stripping them. A French summary scores 0 and loses its place to issues that only matched loosely.
  - **Fix:** normalise the summary and description with the same function `terms.ts` uses (export it) before scoring, and add a French case to `jira-client.test.ts`.
