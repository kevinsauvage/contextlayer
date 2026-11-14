# TODO · Features

New application behaviour. Index and conventions: [`TODO.md`](TODO.md). Items from the 2026-10-26 review cite [`docs/engineering/project-audit-2026-10-26.md`](docs/engineering/project-audit-2026-10-26.md). Items from the 2026-11-02 UX review (`docs/prompts/ux-review.md`) were found by reading the code, not reproduced in a running app.

## P2 · Production-grade: security, limits, deploy, reliability

- [ ] **Store the evidence agent's trace with each analysis** `P2` `E6` `B9`
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

- [ ] **A Verified claim stays Verified after the reviewer rewrites it** `P2`
  - **Context:** the claim textarea changes the text but keeps `status` and `evidenceIds` (`src/components/analysis/draft-editor.tsx:98-105`). The approval check compares only quoted or backticked tokens against the cited evidence (`src/core/evidence/validate.ts:89-97,130-137`), so unquoted rewording (a changed number, version or behaviour) is published as Verified with its citations: a human inference shown as verified, against product principle 1.
  - **Fix:** when the text of a `verified` claim differs from its generated text, downgrade it to `inferred` and say why ("Edited claims are no longer Verified. Set Verified again if the cited evidence still supports the new wording."); restore only on an exact match. Record the choice in `DECISIONS.md`.

- [ ] **Audit: the original ticket isn't shown before it's overwritten** `P2`
  - **Context:** `AuditView` shows the summary, findings and proposed ticket but never the current ticket text (`src/components/analysis/audit-view.tsx:21-58`); the audited ticket (`e1`) survives only if a finding cites it, as a collapsed excerpt (`src/core/analysis/analyze.ts:58-63`). "Approve & update the Jira ticket" replaces `summary` and `description` (`src/integrations/jira/client.ts:191-192`) in one click when nothing is unresolved (`draft-workspace.tsx:233`).
  - **Fix:** store the fetched issue's title and description with the audit result, next to `issueUpdatedAt`; show a "Current ticket" / "Proposed" comparison above the approval bar; always confirm before overwriting ("Replaces the title and description of SHOP-12").

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

- [ ] **The Verified mark has no visible label, and the legend matches it by colour only** `P3`
  - **Context:** other statuses show text pills, but Verified is a green check with screen-reader-only text (`src/components/analysis/ticket-preview.tsx:32-40`), and the "Claims" legend marks it with a green dot, not the check (`:21-26,156`). Product accessibility rule: status is never shown by colour alone.
  - **Fix:** show the check icon in the legend, add `title="Verified"` to the inline check, and add a one-line key under the legend: "✓ = Verified, with citations".

- [ ] **Integrations page gives no next step after connecting** `P3`
  - **Context:** the setup checklist links to `/settings/integrations` with no `returnTo` (`src/app/(app)/projects/page.tsx:55,62`), so after the OAuth round trip the user sees "X connected." with no way forward. A connected provider's button says "Refresh access", which is unclear (`src/components/integrations/provider-card.tsx:82`).
  - **Fix:** use `connectHref(provider, { returnTo: "/projects" })` in the checklist; show "Next: create a project →" when a code source and a tracker are connected; rename the button "Reconnect or change access".

- [ ] **Onboarding has no sign-out or account switch** `P3`
  - **Context:** `/onboarding` renders only the organization form (`src/app/onboarding/page.tsx:20-39`). Invitations are listed only for the signed-in address, so an invitee who signed up with the wrong email can't switch accounts without clearing cookies. `SwitchAccountButton` exists but only the invitation page uses it.
  - **Fix:** add "Signed in as {email} · Use another account" (`SwitchAccountButton`) under the onboarding form.

- [ ] **The analysis header leads with model ID, token counts and cost** `P3`
  - **Context:** the header shows `model · 12.3s · 4567 in / 890 out tokens · $0.0123 · commit abc123` to every member (`src/app/(app)/projects/[projectId]/analyses/[analysisId]/page.tsx:80-89`), operator detail where the tech lead looks for the ticket's state.
  - **Fix:** keep commit and duration in the header; move model, tokens and cost into a collapsed "Run details" block, which can later hold "How this was found".

- [ ] **Clicking an evidence warning doesn't move focus to the claim** `P3`
  - **Context:** `showClaim` switches to Edit, scrolls and rings the whole section for 2.5 s, but focus stays on the warning button and the claim isn't marked (`src/components/analysis/draft-workspace.tsx:100-109`).
  - **Fix:** focus the textarea of the named claim (`description[i]` or `acceptanceCriteria[i]`) and set `aria-invalid` on it until the issue clears.

- [ ] **Audit findings show raw evidence IDs and unrendered inline code** `P3`
  - **Context:** findings show "Evidence: e1, e3" as plain text (`src/components/analysis/audit-view.tsx:32-34`), and `finding.text` and `suggestion` skip `InlineText`, so backticks show raw (`:36-37`).
  - **Fix:** render the IDs as anchors to `EvidenceList` items (add an `id` per item), as `Citations` does in the preview, and wrap the text in `InlineText`.

## Deferred · business validation, not needed for the portfolio

- [ ] **Analysis history and usage metrics** `Deferred` `E5`
  - **Context:** each project has a History tab (`src/app/(app)/projects/[projectId]/(work)/history/page.tsx`), but there is no view across projects and no publish-rate figure. The concierge pilot needs both. The data exists: `analysis.result` holds the model's draft and `editedResult` the published edits.
  - **Fix:** add an organization-wide analysis list with project, kind and status filters. Compute the publish rate and the share of drafts published unchanged (`editedResult` null or equal to `result`) from the `analysis` table.
