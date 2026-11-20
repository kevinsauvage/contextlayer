# TODO · Features

## P2 · Production-grade: security, limits, deploy, reliability

- [ ] **Store the evidence agent's trace with each analysis** `P2` `E6`
  - **Context:** `draftTicket` and `auditIssue` return `candidates` (`src/core/analysis/analyze.ts:44`, `:75`), but `draftFromRequest` keeps only draft, issues, usage and revision (`src/features/ticket-creation/actions.ts:39`) and `src/features/ticket-audit/actions.ts:36` does the same. The agent's tool calls (searches, failed terms, reads, whether it called `selectFiles` or fell back to the files it read: `pathsFromCalls` in `src/integrations/ai/evidence-agent.ts`) are dropped inside `AiEvidenceAgent.select`. When a run misses a file there is no way to see what the agent looked at.
  - **Fix:** define a Zod `retrievalTrace` schema in `src/core/context/` (searches with their terms and `failedTerms`, `listFiles` filters, read paths, selected paths, `concluded: boolean`, and per candidate its kind, reference and line range, no excerpt). Return it from `EvidenceSelector.select` (`src/core/analysis/generators.ts:33`) and thread it through `GatheredContext`, `CreationResult` and `AuditResult`. Add a nullable `retrieval` jsonb column on `analysis` (`src/infrastructure/db/schema/app.ts`, plus a migration), write it in `recordOutcome` (`src/features/analysis/run.ts`) and clear it in `restartAnalysis`. Show it in a collapsed "How this was found" block on the analysis page.

- [ ] **Email verification, invitations and password reset** `P2`
  - **Context:** no email provider exists, so accounts are unverified, there is no password reset, and invitation ids are the only secret. Because `listInvitationsForUser` (`src/features/organizations/queries.ts:56`) returns nothing for an unverified user, `/onboarding` never lists an invitation today. On a public site anyone can also sign up with fake addresses.
  - **Fix:** add an email provider (Resend or another Marketplace integration) behind a small `sendEmail` in `src/integrations/`. In `src/infrastructure/auth/auth.ts`, enable `emailVerification` (send on sign-up, require it to sign in) and `emailAndPassword.sendResetPassword`. Pass `requireEmailVerificationOnInvitation: true` and `sendInvitationEmail` to `organization()` (line 35). Add the reset-password pages under `src/app/(auth)/` and let them through the `src/proxy.ts` matcher.

- [ ] **Error monitoring and structured logging** `P2`
  - **Context:** failures are only `console.error`/`console.warn` calls (`src/features/analysis/run.ts`, `publish.ts`, `src/features/integrations/oauth-flow.ts`, `resources.ts`, `src/features/organizations/actions.ts`, `src/integrations/github/source.ts`, `src/core/context/gather.ts`), so on a host nobody sees them.
  - **Fix:** add `@sentry/nextjs`. Initialise it in `src/instrumentation.ts` `register()`, export `onRequestError`, and add `instrumentation-client.ts` (see `node_modules/next/dist/docs/01-app/02-guides/instrumentation.md`). Strip request bodies and set `sendDefaultPii: false`. Replace the `console.*` calls in `features`/`integrations` with a small logger in `src/infrastructure/` that tags organization, analysis and provider ids and never logs tokens, prompts or source excerpts. Leave the one in `core/context/gather.ts` alone (core must not import infrastructure); return the failure to the caller instead if it needs reporting.

- [ ] **Run analyses in the background with `after()`** `P2`
  - **Context:** `startAnalysis` and `restartAnalysis` await the whole run inside a Server Action (`src/features/analysis/run.ts:91`, `:134`); with the evidence agent (9 to 15 s) plus drafting, that takes 15 s or more. The client's action queue is blocked meanwhile (autosave, publish and the next chat message wait), and a closed tab loses the redirect.
  - **Fix:** have the actions insert or claim the row, schedule `recordOutcome` with `after()` from `next/server` (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`), and redirect or `refresh()` at once. On the analysis page, call `router.refresh()` every 2 s while the row is `running`. Keep `maxDuration = 300` on the pages, because `after()` runs inside the same host limit. Then remove the stale-run rules in `run.ts`/`src/core/analysis/stale.ts` that only existed for dead requests, if a host test shows a closed tab no longer stops the run. If runs approach the limit, move to Vercel Workflow or Queues and keep the polling.

- [ ] **Show analysis progress steps** `P2`
  - **Context:** while a run is `running`, the user sees only a pending label ("Refresh in a moment": `action-form.tsx:93-96`, `ticket-chat.tsx:84`, `analyses/[analysisId]/page.tsx:101`), although the run passes through distinct stages (reading code, related issues, drafting, validating). Depends on "Run analyses in the background with `after()`". The groom proposes P3 for this one.
  - **Fix:** add a nullable `step` column on `analysis`. Have `draftTicket`/`auditIssue` report stages through an optional `onStep` callback that `run.ts` writes to the row, and render the steps as a checklist on the polling analysis page.

- [ ] **Account settings: profile, password and account deletion** `P2`
  - **Context:** found in the 2026-11-20 portfolio review. The user menu offers only the theme and sign-out (`src/components/layout/user-menu.tsx`); there is no page to change one's name or password, and no way to delete an account, which a public sign-up needs (GDPR erasure). Deleting a user would also fail today: `analysis.created_by_user_id` and `integration_connection.connected_by_user_id` reference `user` without an `onDelete` rule (`src/infrastructure/db/schema/app.ts:31`, `:81`), while `analysis_run` cascades.
  - **Fix:** add `/settings/account` with Better Auth's `updateUser` and `changePassword` (revoking other sessions), and enable `user.deleteUser` in `src/infrastructure/auth/auth.ts` behind a typed confirmation like `DeleteOrganization`. Decide what an analysis or connection keeps when its author leaves (make the columns nullable with `onDelete: "set null"`, plus a migration), refuse deletion while the user is the last owner of an organization, record the choice in `DECISIONS.md`, and link the page from the user menu.

## P3 · Later: optional features and deeper hardening

- [ ] **Bring-your-own AI key per organization** `P3`
  - **Context:** some customers will not accept code going to our provider account (see the data-flow page in [`TODO-NON-CODE.md`](TODO-NON-CODE.md)).
  - **Fix:** let an organization store its own provider key (encrypted like tokens) and use it for its analyses. Optional; build only if discovery asks for it.

- [ ] **AI SDK DevTools in development** `P3`
  - **Context:** tuning prompts means reading raw prompts and responses, and nothing shows them. The AI SDK ships `@ai-sdk/devtools`, a local-only viewer for `generateText` calls (`node_modules/ai/docs/03-ai-sdk-core/65-devtools.mdx`).
  - **Fix:** add it as a dev dependency, wrap the model with its middleware only when `NODE_ENV` is `development`, and note the viewer command in `docs/engineering/development.md`.

- [ ] **Linear as a second tracker** `P3`
  - **Context:** the registry (`src/integrations/registry.ts:9`) has only Jira as a tracker, so the generic `TrackerProvider` seam is untested. The groom proposes Deferred (`docs/product/plan.md:38` lists it as out of scope for now).
  - **Fix:** implement `src/integrations/linear/provider.ts` (OAuth, team listing, `getResource`, issue search, get and create, Zod-validated responses, unit tests) following `docs/architecture/overview.md:68`, and register it. No UI change should be needed; if one is, fix the seam instead.

- [ ] **GitLab as a second code host** `P3`
  - **Context:** the registry (`src/integrations/registry.ts:9`) has only GitHub as a source, so the generic `SourceProvider` seam (`listFiles`, `readFile`, `searchContent` with `failedTerms`, `urlFor`) is untested. The groom proposes Deferred (`docs/product/plan.md:38`).
  - **Fix:** implement `src/integrations/gitlab/provider.ts` and its source (OAuth, project listing, tree, file read, code search, Zod-validated responses, unit tests) following `docs/architecture/overview.md:68`, and register it. No UI change should be needed; if one is, fix the seam instead.

- [ ] **Edit a project** `P3`
  - **Context:** changing the repository or tracker project means deleting and recreating the project, which loses its analysis history.
  - **Fix:** add an edit card to the project's Settings tab (`src/app/(app)/projects/[projectId]/(work)/settings/page.tsx`, which only has the danger zone) that reuses `ResourcePicker` and an `updateProject` action, validating the new resources the same way `createProject` does.

- [ ] **Draft versions** `P3`
  - **Context:** re-runs overwrite `result` in place, so a worse redraft cannot be undone.
  - **Fix:** add an `analysis_version` table (analysis id, input, result, created at) written by `restartAnalysis`, and a version list with "Restore" on the analysis page.

- [ ] **Redrafting keeps manual edits** `P3`
  - **Context:** each chat message or answer round re-runs the whole pipeline and replaces the draft, so manual edits are discarded. That is why `DiscardEditsConfirm`, `setDraftEdited`, autosave, `editedResult` and `saveDraftEdits` exist.
  - **Fix:** pass the current (edited) draft into `draftTicket` and the create prompt as the starting point, tell the model to keep unrelated text unchanged, then remove the discard-edits confirmation and the "replaces manual edits" copy in `ticket-chat.tsx` and `open-questions.tsx`. Pairs with "Draft versions" for undo.

- [ ] **Chat and answers for audits** `P3`
  - **Context:** create analyses have `TicketChat` and structured answers through one action, `refineTicket` (`src/features/ticket-creation/actions.ts:109`, via `redraft`, which loads only `kind: "create"`). `AuditView` (`src/components/analysis/audit-view.tsx`) shows the proposed ticket's questions read-only and cannot re-run in place, although the outdated-result copy (`outdated-result.tsx`, `audit-view.tsx:19,56`) and the stale-issue error (`src/features/ticket-audit/actions.ts:73`) tell the user to re-run.
  - **Fix:** first slice: a "Run again" button that re-audits the same issue key. Then let `redraft` accept the audit kind and re-run `auditIssue` with the merged answers and messages (add an `answers` input to `auditIssue` and the audit prompt), store them in the audit's `StoredAnalysisInput`, and render `TicketChat` in `AuditView`.

- [ ] **Clicking an evidence warning doesn't move focus to the claim** `P3`
  - **Context:** `showClaim` switches to Edit, scrolls and rings the whole section for 2.5 s, but focus stays on the warning button and the claim isn't marked (`src/components/analysis/draft-workspace.tsx:100-109`).
  - **Fix:** focus the textarea of the named claim (`description[i]` or `acceptanceCriteria[i]`) and set `aria-invalid` on it until the issue clears.

## Deferred · business validation, not needed for the portfolio

- [ ] **Analysis history and usage metrics** `Deferred` `E5`
  - **Context:** each project has a History tab (`src/app/(app)/projects/[projectId]/(work)/history/page.tsx`), but there is no view across projects and no publish-rate figure. The concierge pilot needs both. The data exists: `analysis.result` holds the model's draft and `editedResult` the published edits.
  - **Fix:** add an organization-wide analysis list with project, kind and status filters. Compute the publish rate and the share of drafts published unchanged (`editedResult` null or equal to `result`) from the `analysis` table.
