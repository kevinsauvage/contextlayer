# TODO: architecture and code quality

Engineering debt found in a review of `src/` and `tests/` on 2026-10-23. Product work stays in [`TODO.md`](TODO.md). Same conventions: `[ ]` open, `[~]` partly done; each item has **Context** (what and where) and **Fix** (how, and what done means). Run `pnpm check` after each item.

## Assessment

What holds up:

- The layers (`app → features → core`, `integrations` implementing `core` contracts) are clean and enforced by ESLint. `core` is pure and the pipeline is tested with fakes.
- The provider registry keeps routes, storage, token refresh and UI generic.
- External data and AI output go through Zod; tenant scoping is consistent and tested.

Where debt is building up, by impact:

1. **Server actions repeat the same load → authorize → check → run steps.**
2. **Client components repeat the same mutation boilerplate** (transition, error state, refresh, error paragraph) about ten times, plus two near-identical confirm dialogs.
3. **Big files mix concerns**: `retrieve.ts` (terms, synonyms, imports, scoring) and the analysis page (five inline components).
4. **Untyped JSON columns** (`analysis.input`, `analysis.result`) are parsed differently in each place that reads them.
5. **Two ways to mutate**: most writes are server actions, but organization writes call the Better Auth client directly from components.

## P2: Duplication

- [ ] **Shared server-action helpers**
  - Context: `publishTicket` and `applyAuditToTracker` repeat parse draft → `requireOrgContext` → `getAnalysis` → kind and status check → already-published check → `publishApproved`. `createTicketAnalysis` and `createAuditAnalysis` both load the project, then build `new AiGenerator(getEnv().AI_MODEL)` and `buildProjectContext` the same way.
  - Fix: in `src/features/analysis/`, add `loadAnalysis(analysisId, { kind, status, unpublished })` returning a typed result or `{ error }`, `loadProject(projectId)`, and `defaultGenerator()`. Rewrite the four actions on top of them; each should shrink to about ten lines.

- [ ] **Client mutation hook**
  - Context: `useTransition` + `useState<string>()` error + `router.refresh()` is written out in `disconnect-button`, `delete-project-button`, `organization-name-form`, `invite-form`, `member-actions`, `accept-invitation`, `clarify-questions`, `onboarding-form` and `draft-workspace`. `<p role="alert" className="text-sm text-destructive">` appears in 10 files.
  - Fix: add `src/components/use-mutation.ts` (`run(fn)`, `pending`, `error`, optional refresh) and `src/components/form-error.tsx`. Move the components above onto them, then delete `AsyncButton` from `member-actions.tsx`.

- [ ] **One confirm dialog**
  - Context: `disconnect-button.tsx` and `delete-project-button.tsx` are the same AlertDialog with different copy and actions.
  - Fix: add `ConfirmButton({ trigger, title, description, confirmLabel, action })` built on the mutation hook, and make both files thin wrappers or remove them.

- [ ] **Claim status labels in one place**
  - Context: the labels for `verified | inferred | unknown | needs_clarification` are defined in `src/core/requirements/render.ts`, `src/components/status-badge.tsx` and `src/components/ticket-preview.tsx` (by matching the display text), and the status list again in `draft-editor.tsx`.
  - Fix: export `CLAIM_STATUS_LABELS` and the status list from `src/core/evidence/schemas.ts` (use `claimStatusSchema.options`), and use them everywhere.

- [ ] **Preview parses strings that the renderer just built**
  - Context: `ticketSections` returns strings like `"Needs clarification: …"`, and `ticket-preview.tsx` splits them back apart with a regex to draw pills. Changing a label in one place silently breaks the other.
  - Fix: have `ticketSections` return items `{ status?: ClaimStatus; text; url? }`. Format the prefix in `src/integrations/jira/adf.ts` for Jira, and render pills from `status` in the preview. Update `tests/unit/jira-adf.test.ts`.

- [ ] **Native select styling**
  - Context: the same `h-8 rounded-lg border bg-background px-2 text-sm` select appears in `project-form.tsx` and `invite-form.tsx`, with a variant in `draft-editor.tsx`.
  - Fix: add the shadcn `native-select` component (`pnpm exec shadcn add native-select`) and use it in all three.

- [ ] **Test seeding**
  - Context: `tenant-isolation`, `connections` and `analysis-run` tests each insert their own connections and project rows.
  - Fix: add `seedConnections(db, orgId)` and `seedProject(db, orgId)` to `tests/helpers/db.ts`, and use them in all three files.

- [ ] **`describeProvider` copies fields by hand**
  - Context: `src/core/integrations/provider.ts` lists the eight descriptor fields in the type and again in `describeProvider`. TypeScript catches a missing field, so this is only extra editing when a field is added.
  - Fix: declare `PROVIDER_DESCRIPTOR_KEYS` once, derive `ProviderDescriptor` from it (`Pick<…>`), and build the descriptor from those keys. Low priority.

## P2: Structure

- [ ] **Split `src/core/context/retrieve.ts`**
  - Context: 221 lines covering stopwords, synonyms, quoted-text stripping, term extraction, import resolution, barrel handling and scoring.
  - Fix: move term extraction (stopwords, synonyms, normalisation) to `terms.ts` and import following to `imports.ts`, keeping scoring and `retrieveFileEvidence` in `retrieve.ts`. Re-export nothing; update `gather.ts` and the tests' imports.
- [ ] **Split the analysis page**
  - Context: `src/app/(app)/projects/[projectId]/analyses/[analysisId]/page.tsx` (221 lines) defines `WarningList`, `RequestPanel`, `CreationView` and `AuditView` inline, against "route files stay thin".
  - Fix: move them to `src/components/analysis/` (`evidence-warnings.tsx`, `request-panel.tsx`, `creation-view.tsx`, `audit-view.tsx`), so the page only loads data and composes.
- [ ] **Group components by feature**
  - Context: `src/components/` holds about 30 files side by side (auth, analysis, integrations, organization, layout), which makes ownership and reuse hard to see.
  - Fix: create `components/{analysis,integrations,organization,projects,layout,auth}/` and move files; keep shared pieces (`page-header`, `form-error`, `confirm-button`, `use-mutation`) at the root. Update imports only.
- [ ] **Organization writes outside the features layer**
  - Context: renaming, inviting, removing members, cancelling or accepting invitations and creating organizations call `authClient.organization.*` straight from components, while every other write is a server action in `src/features`. These paths are not testable server-side, and error handling differs per component.
  - Fix: add `src/features/organizations/actions.ts` server actions that call `getAuth().api.*` with request headers (permissions stay enforced by Better Auth) and return `ActionState`; components call those. Keep `authClient` only for sign-in, sign-out and `setActive`.
- [ ] **Type the JSON columns**
  - Context: `analysis.input` and `analysis.result` are `jsonb` typed `unknown`; `src/features/analysis/input.ts`, `auditInputSchema` in the audit actions, and the analysis page each parse them their own way.
  - Fix: define `analysisInputSchema` as a discriminated union (`create`: request and answers; `audit`: issue key) in `src/features/analysis/input.ts`, use `$type` on the columns, and parse in one `readAnalysis()` that also handles legacy `title` rows. Delete `auditInputSchema`.
- [ ] **Naming collisions**
  - Context: `provider-card.tsx` has a local `StatusBadge` (connection status), and `status-badge.tsx` exports another `StatusBadge` (claim status). `analysis-status.tsx` is a third status component.
  - Fix: rename them `ClaimStatusBadge`, `ConnectionStatusBadge` and `AnalysisStatusBadge`.
- [ ] **Misleading return types**
  - Context: `deleteProject` is typed `Promise<ActionState>` but always redirects; `startRow` and `runAnalysis` mix creating and re-running behind an optional `rerunId`.
  - Fix: type `deleteProject` as `Promise<never>` after the error mapper handles failures (or return an error before the redirect), and split `runAnalysis` into `startAnalysis` and `restartAnalysis` that share the execute-and-record step.

## P3: Performance

- [ ] **Publishing builds a full context it does not need**
  - Context: `publishTicket` and `applyAuditToTracker` call `buildProjectContext`, which runs `GithubSource.connect` (a GitHub API call) only to reach the tracker.
  - Fix: add `buildProjectTracker(db, project)` in `src/features/analysis/project-context.ts`, and use it for publishing.
- [ ] **Project creation re-lists every resource**
  - Context: `createProject` calls `listResources` on both providers to check that the chosen repository and tracker project exist, which means paging through all of a large account's repositories.
  - Fix: add an optional `getResource(ctx, id)` to the provider contract (GitHub `repos.get`, Jira `project/{key}`), and fall back to `listResources` only when a provider lacks it.
- [ ] **Writes on page render**
  - Context: `failStaleAnalyses` runs an `UPDATE` while rendering the project and analysis pages.
  - Fix: compute "timed out" when reading (status `running` and older than the limit) and show it as failed without writing; mark the row failed only on the next re-run or by a scheduled cleanup.

## P3: Hygiene

- [ ] **UI copy in core errors**
  - Context: the `ReconnectRequiredError` message in `src/core/integrations/provider.ts` names the "Integrations" page, so `core` knows about the UI.
  - Fix: keep only the connection label in the error, and build the user-facing sentence in the action-error mapper.
- [ ] **Escape JQL values**
  - Context: `JiraClient.searchRelated` interpolates terms and the project key into JQL. Today that is safe only because `extractTerms` emits `[a-z0-9]` and project keys are validated, which is easy to break later.
  - Fix: add a `jqlString()` helper that escapes quotes and backslashes, use it for every interpolated value, and unit-test it.
- [ ] **Slug generation on the client**
  - Context: `onboarding-form.tsx` builds the organization slug with `Math.random()` in the browser.
  - Fix: generate the slug in the new organization server action (`crypto.randomUUID`-based suffix), and retry when the slug is taken.
- [ ] **Role names as string literals**
  - Context: `"owner"`, `"admin"` and `"member"` appear in `session.ts`, `invite-form.tsx` and the organization settings page.
  - Fix: export `ROLES` and `ADMIN_ROLES` from one module (`src/features/organizations/roles.ts`, client-safe) and use them everywhere.
