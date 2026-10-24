# TODO · Bugs

Existing behaviour that is wrong: it fails, or silently returns incomplete or incorrect results. Index and conventions: [`TODO.md`](TODO.md).

## P1 · Prove the product

- [ ] **Publishing trusts evidence sent by the client** `P1` `C3`
  - **Context:** `publishTicket`, `applyAuditToTracker` and `saveDraftEdits` parse the whole `TicketDraft` from the browser, `evidence` included, and `parseApprovedDraft` only checks that cited ids exist in that same list. Any client can add an evidence item with an arbitrary excerpt and URL and mark a claim `verified` against it, and Jira then shows it as traceable. DECISIONS says "the model cites candidate evidence ids and never writes evidence itself … prevents fabricated sources", which holds at generation but not at publish.
  - **Fix:** accept only claim text, status, citation ids and the other editable fields from the client; rebuild `evidence` on the server from the stored result (`analysis.result.evidence`, or the audit report's) and reject ids it does not contain. Add a test that a forged evidence item is rejected.

- [ ] **Untrusted text can close the prompt's data tags** `P1` `C3`
  - **Context:** `contextBlock` and `buildAuditPrompt` in `src/integrations/ai/prompt.ts` paste excerpts, file paths, issue summaries and descriptions between `<source>`, `<context>` and `<ticket>` tags without escaping. A repository file or Jira description containing `</source></context>` (or a path with a `"`) ends the data block early, and the rest reads as prompt text outside the "untrusted data" rule.
  - **Fix:** neutralise tag-like sequences in every interpolated value (for example escape `<` / `>` or replace `</` with `<\/`) and quote attributes safely, in one helper used by both builders. Unit-test the escaping and add the breakout fixture in [`TODO-QUALITY.md`](TODO-QUALITY.md).

- [ ] **Evidence links point at the branch, not the commit** `P1`
  - **Context:** `GithubSource` reads files and builds `urlFor` links on `default_branch`. Once the branch moves, a published ticket's `path#L12-L40` link shows different lines, so "verified" citations drift silently; files read during one analysis can also come from different commits if a push lands mid-run.
  - **Fix:** resolve the branch to its commit SHA in `GithubSource.connect`, then use that SHA for `getTree`, `readFile` and `urlFor`. Store the SHA on the analysis so a re-run can say the code changed.

- [ ] **Audit findings that require evidence are not checked** `P1`
  - **Context:** the audit prompt says a `conflict_with_code` or `existing_implementation_or_duplicate` finding "must be verified with evidence", but `validateEvidenceReferences` only checks that `verified` claims cite something. A model that files one of those categories as `inferred` with no citation passes, and the report presents an unproven conflict or duplicate.
  - **Fix:** in `auditIssue` (or a small audit-specific check in `src/core/evidence/validate.ts`), add an evidence issue for those two categories unless the finding is `verified` with at least one citation. Add the case to `tests/unit/analyze.test.ts`.

- [ ] **Files with no matching content still become evidence** `P1` `E6`
  - **Context:** `retrieveFileEvidence` shortlists a file on path matches or code-search rank, then scores the content, but never drops files whose final score is 0 or below. A code-search hit whose text does not contain the terms (GitHub tokenises differently from a substring check), or a test file pushed negative by the penalty, is still sent to the model as context, with an excerpt taken from the top of the file because `excerptAround` finds no hit.
  - **Fix:** filter `ranked` to `score > 0` before slicing, and add a case to `tests/unit/retrieve.test.ts` where a search hit without matching content is left out.

## P2 · Connect and deliver

- [ ] **Two approvals can create two Jira issues** `P2`
  - **Context:** `publishApproved` checks `publishedIssueKey` in `loadAnalysis`, calls the tracker, and only then records the key with an unconditional update. Two tabs (or a retry) both pass the check and both create an issue. If the tracker write succeeds but the database update fails, the user is told "The issue tracker rejected the change", the key is not stored, and trying again creates a duplicate.
  - **Fix:** claim the row first with a conditional update (for example a `publishing` marker set `WHERE published_issue_key IS NULL AND publishing IS NULL`), release it on tracker failure, and report a database failure after a successful write as "Published as KEY, but not recorded" instead of a tracker error.

- [ ] **Long or multi-line titles fail in Jira with a generic error** `P2`
  - **Context:** `draftBodySchema.title` has no maximum and the editor allows any text; the prompt only asks for under 80 characters. Jira rejects a summary over 255 characters or containing a line break, and the user sees "The issue tracker rejected the change".
  - **Fix:** cap `title` at 255 characters and strip line breaks in the schema, so the editor and `parseApprovedDraft` report it, and map a Jira 400 to its field message in `publishApproved`.

- [ ] **Jira project picker stops at 100 projects** `P2`
  - **Context:** `listJiraProjects` requests `/project/search?maxResults=100` once and ignores `isLast` / `nextPage`, so larger sites silently miss projects in the new-project form.
  - **Fix:** page through `/project/search` until `isLast`, validating each page with Zod, and add a two-page case to `tests/unit/jira-client.test.ts`.

- [ ] **Applying an audit overwrites later Jira edits** `P2`
  - **Context:** `applyAuditToTracker` replaces the issue's summary and description with the proposal. If someone edited the issue in Jira after the audit ran, those edits are lost without warning.
  - **Fix:** store the issue's `updated` timestamp when auditing; before applying, fetch it again and, if it changed, refuse with "The issue changed in Jira since this audit; re-run it" (or show the diff).

## P3 · Harden and validate

- [ ] **Some admin actions show the error page instead of a message** `P3`
  - **Context:** `renameOrganization`, `inviteMember`, `removeMember`, `updateMemberRole`, `cancelInvitation` and `deleteProject` call `requireOrgAdmin()` outside `withActionErrors` or their `try`, so a member whose role was lowered mid-session gets the error boundary, against the DECISIONS rule that a non-admin sees a message.
  - **Fix:** wrap those actions in `withActionErrors` (or move the check inside the existing `try` that calls `failure`), and add one integration test for a member calling an admin action.

- [ ] **A slow run can overwrite the re-run that replaced it** `P3`
  - **Context:** `restartAnalysis` lets a re-run through once a `running` row is older than `STALE_ANALYSIS_MS`, but the first run's `recordOutcome` still updates by `id` only. If it finishes late, it overwrites the newer run's result. A re-run also rewrites `createdAt`, so the history order and the creation date change.
  - **Fix:** add a `started_at` column (staleness and latency use it, `createdAt` stays fixed) and a per-run token, and make `recordOutcome` update only `WHERE id = ? AND run_token = ?`.
