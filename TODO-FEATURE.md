# TODO · Features

New application behaviour. Index and conventions: [`TODO.md`](TODO.md). Items from the 2026-10-26 review cite [`docs/engineering/project-audit-2026-10-26.md`](docs/engineering/project-audit-2026-10-26.md).

## P1 · Prove it: evaluation and correctness fixes

- [ ] **Local git source for development and evals only** `P1` `E6`
  - **Context:** `DirectorySource` is used only by tests and evals but sits in `src/integrations/filesystem/`, walks the tree without honoring `.gitignore`, and scores every file's content. Measuring recall on this repository needs a source that reads a local checkout, because it has no GitHub remote yet. Production keeps reading GitHub through `GithubSource`; this source is not for the deployed site.
  - **Fix:** add a `GitSource` implementing `ContextSource` over a local checkout (`git ls-files`, `git grep` for `searchContent`, `git rev-parse HEAD` for `revision`), use it in `tests/evaluation/draft-case.ts` and for the recall runs, keep it out of the provider registry, and delete `DirectorySource` with its duplicated extension list.

## P2 · Production-grade: security, limits, deploy, reliability

- [ ] **Store the retrieval candidates with each analysis** `P2` `E6` `B9`
  - **Context:** `draftFromRequest` returns only the draft, issues, usage and revision (`src/features/ticket-creation/actions.ts:39`) and the audit action does the same, so the candidates `draftTicket` and `auditIssue` retrieve are dropped. When a run misses a file there is no way to see what was retrieved or why.
  - **Fix:** add a `retrieval` jsonb column on `analysis` holding the terms used (heuristic and model) and, per candidate, its reference, kind, line range and score, but not the excerpt. Show it in a collapsed "How this was found" block on the analysis page.

- [ ] **Usage limits and rate limiting** `P2`
  - **Context:** every analysis, refinement and answer round spends model tokens, sign-up is open (`src/infrastructure/auth/auth.ts:18`) and nothing caps runs per user or in total, so on any deployed instance one user or script could use up the AI budget.
  - **Fix:** first, with no code, set a hard monthly spending limit on the AI provider account. Then count runs and tokens per user per day and in total per day from the `analysis` table, refuse new runs over a configurable limit with a clear message ("the daily demo limit is reached, try tomorrow"), and add a per-user rate limit (for example 5 runs per minute). Count runs, not dollars, unless "Replace the price table" in [`TODO-REFACTOR.md`](TODO-REFACTOR.md) is done.

- [ ] **Email verification, invitations and password reset** `P2`
  - **Context:** no email provider exists, so accounts are unverified and invitation links are the only secret. On a public site anyone can create accounts with fake addresses. The usage caps limit the damage; verification closes the gap.
  - **Fix:** add an email provider (Resend or another Marketplace integration), enable Better Auth `emailVerification` and `sendResetPassword`, require verified email to accept invitations, and set `sendInvitationEmail` in the organization plugin.

- [ ] **Error monitoring and structured logging** `P2`
  - **Context:** failures are only `console.error` calls (OAuth callbacks, resource listing, publishing).
  - **Fix:** add Sentry (or similar) for server and client errors, and a small logger that tags organization, analysis and provider ids without logging tokens or source code.

- [ ] **Content Security Policy** `P2`
  - **Context:** `next.config.ts` sets basic security headers but no CSP.
  - **Fix:** add a nonce-based CSP in `src/proxy.ts`, allowing only self and the needed origins; test in report-only mode first.

- [ ] **Run analyses outside the server action and show progress** `P2`
  - **Context:** `startAnalysis` and `restartAnalysis` await the whole run inside a Server Action (`src/features/analysis/run.ts`), which takes 10–40 s. The user sees only a pending label, the client's action queue is blocked (autosave, publish and the next message wait; see the autosave bug in [`TODO-BUG.md`](TODO-BUG.md)), a closed tab loses the redirect, and the lease, stale-run and run-token code exists to recover from dead requests.
  - **Fix:** have the action insert the row, schedule the run with `after()` from `next/server`, and redirect at once. Write a `step` column (reading code, related issues, drafting, validating) as the run advances, and poll the row from the analysis page with `router.refresh()` every 2 s while it is `running`, rendering the steps as a checklist. Then simplify `run.ts` where the stale rules are no longer needed. Keep `maxDuration` on the page: `after()` runs inside the same host time limit (`after.md`). If runs approach that limit, move to Vercel Workflow or Queues and keep the polling. Test it on the real host, since a closed tab must not stop the run.

## P3 · Polish and later

- [ ] **Bring-your-own AI key per organization** `P3`
  - **Context:** some customers will not accept code going to our provider account (see the data-flow page in [`TODO-NON-CODE.md`](TODO-NON-CODE.md)).
  - **Fix:** let an organization store its own provider key (encrypted like tokens) and use it for its analyses. Optional; build only if discovery asks for it.

- [ ] **AI SDK DevTools in development** `P3`
  - **Context:** tuning prompts means reading raw prompts and responses, and nothing shows them. The AI SDK ships `@ai-sdk/devtools`, a local-only viewer for `generateText` calls (`node_modules/ai/docs/03-ai-sdk-core/65-devtools.mdx`).
  - **Fix:** add it as a dev dependency, wrap the model with its middleware only when `NODE_ENV` is `development`, and note the viewer command in `docs/engineering/development.md`.

- [ ] **Second providers: Linear and GitLab** `P3`
  - **Context:** the registry (`src/integrations/registry.ts`) has only GitHub and Jira, so the generic design is untested. A proposed session for Linear is waiting.
  - **Fix:** implement Linear as a `TrackerProvider` and GitLab as a `SourceProvider` (OAuth, resource listing, `getResource`, adapter, Zod-validated responses, unit tests). No UI change should be needed; if one is, fix the seam instead.

- [ ] **Edit a project** `P3`
  - **Context:** changing the repository or tracker project means deleting and recreating the project, which loses its analysis history.
  - **Fix:** add a project settings page that reuses `ResourcePicker` and an `updateProject` action, validating the new resources the same way `createProject` does.

- [ ] **Draft versions** `P3`
  - **Context:** re-runs overwrite `result` in place, so a worse redraft cannot be undone.
  - **Fix:** add an `analysis_version` table (analysis id, input, result, created at) written by `restartAnalysis`, and a version list with "Restore" on the analysis page.

- [ ] **Redrafting keeps manual edits** `P3`
  - **Context:** each chat message or answer round re-runs the whole pipeline and replaces the draft, so manual edits are discarded. That is why `DiscardEditsConfirm`, `setDraftEdited`, autosave, `editedResult` and `saveDraftEdits` exist.
  - **Fix:** pass the current (edited) draft into `draftTicket` and the create prompt as the starting point, tell the model to keep unrelated text unchanged, then remove the discard-edits confirmation and the "replaces manual edits" copy in `ticket-chat.tsx` and `open-questions.tsx`. Pairs with "Draft versions" for undo.

- [ ] **Chat and answers for audits** `P3`
  - **Context:** create analyses have `TicketChat` and structured answers; audits show the proposed ticket's questions read-only and cannot be re-run in place.
  - **Fix:** generalise `refineTicket` and `answerQuestions` to accept the audit kind (pass refinements and answers to `auditIssue`), and show `TicketChat` in `AuditView`.

## Deferred · not needed to build the product properly

- [ ] **Analysis history and usage metrics** `Deferred` `E5`
  - **Context:** there is no view across projects, and no data on how often drafts are published unchanged; the concierge pilot needs both.
  - **Fix:** add an organization-wide analysis list with filters, and track publish rate and edits before publish.
