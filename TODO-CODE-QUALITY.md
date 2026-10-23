# TODO: architecture and code quality

Engineering debt found in a review of `src/` and `tests/` on 2026-10-23. Product work stays in [`TODO.md`](TODO.md). Same conventions: `[ ]` open, `[~]` partly done; each item has **Context** (what and where) and **Fix** (how, and what done means). Run `pnpm check` after each item.

## Assessment

What holds up:

- The layers (`app → features → core`, `integrations` implementing `core` contracts) are clean and enforced by ESLint. `core` is pure and the pipeline is tested with fakes.
- The provider registry keeps routes, storage, token refresh and UI generic.
- External data and AI output go through Zod; tenant scoping is consistent and tested.

Where debt is building up, by impact:

1. **Big files mix concerns**: `retrieve.ts` (terms, synonyms, imports, scoring) and the analysis page (five inline components).
2. **Untyped JSON columns** (`analysis.input`, `analysis.result`) are parsed differently in each place that reads them.
3. **Two ways to mutate**: most writes are server actions, but organization writes call the Better Auth client directly from components.

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
