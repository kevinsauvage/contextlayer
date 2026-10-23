# TODO: architecture and code quality

Engineering debt found in a review of `src/` and `tests/` on 2026-10-23. Product work stays in [`TODO.md`](TODO.md). Same conventions: `[ ]` open, `[~]` partly done; each item has **Context** (what and where) and **Fix** (how, and what done means). Run `pnpm check` after each item.

## Assessment

What holds up:

- The layers (`app → features → core`, `integrations` implementing `core` contracts) are clean and enforced by ESLint. `core` is pure and the pipeline is tested with fakes.
- The provider registry keeps routes, storage, token refresh and UI generic.
- External data and AI output go through Zod; tenant scoping is consistent and tested.

The duplication, structure and typing debt this review found is fixed; the remaining open items are below.

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
- [ ] **Role names as string literals**
  - Context: `"owner"`, `"admin"` and `"member"` appear in `session.ts`, `invite-form.tsx` and the organization settings page.
  - Fix: export `ROLES` and `ADMIN_ROLES` from one module (`src/features/organizations/roles.ts`, client-safe) and use them everywhere.
