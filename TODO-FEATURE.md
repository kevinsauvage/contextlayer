# TODO · Features

New application behaviour. Index and conventions: [`TODO.md`](TODO.md).

## P1 · Prove the product

- [~] **Cost per analysis** `P1` `H7` `C5`
  - **Context:** real runs use about 2.4k input and 3.2k output tokens and cost well under a cent, so H7 looks safe; the app records no price, so cost per analysis and per model is still not tracked.
  - **Fix:** add a per-model price table (input and output per million tokens) in `src/core` or the env, compute cost in `startAnalysis` / `restartAnalysis`, store it in a `cost_usd` column, and show it next to the token counts on the analysis page.

- [ ] **Model-based query expansion** `P1` `E6`
  - **Context:** `extractTerms` uses keywords plus a synonym map and still misses `mail/send.ts` for "Add password reset". Code search now runs per term and content scoring counts occurrences, but there is no semantic expansion; embeddings stay deferred until measured.
  - **Fix:** before retrieval, ask a small model for 5–10 code-search terms (identifiers, file names) from the request and merge them with `extractTerms`. Measure recall on the fixtures and two real repositories (E6), and consider embeddings only if recall stays under 90%.

- [ ] **Import following for Python and Go** `P1`
  - **Context:** `resolveImports` in `src/core/context/imports.ts` only understands JS/TS imports.
  - **Fix:** add resolvers for Python (`from x import y`) and Go packages before relying on import following in those stacks.

- [ ] **Monorepo scoping** `P1`
  - **Context:** a project always spans the whole repository, so retrieval in a monorepo mixes unrelated apps.
  - **Fix:** add an optional subdirectory to the project (`source_resource_id` like `owner/repo#apps/web`) and restrict file listing and search to it.

## P2 · Connect and deliver

- [ ] **Second providers: Linear and GitLab** `P2`
  - **Context:** the registry (`src/integrations/registry.ts`) has only GitHub and Jira, so the generic design is untested. A proposed session for Linear is waiting.
  - **Fix:** implement Linear as a `TrackerProvider` and GitLab as a `SourceProvider` (OAuth, resource listing, `getResource`, adapter, Zod-validated responses, unit tests). No UI change should be needed; if one is, fix the seam instead.

- [ ] **Edit a project** `P2`
  - **Context:** changing the repository or tracker project means deleting and recreating the project, which loses its analysis history.
  - **Fix:** add a project settings page that reuses `ResourcePicker` and an `updateProject` action, validating the new resources the same way `createProject` does.

- [ ] **Draft versions** `P2`
  - **Context:** re-runs overwrite `result` in place, so a worse redraft cannot be undone.
  - **Fix:** add an `analysis_version` table (analysis id, input, result, created at) written by `restartAnalysis`, and a version list with "Restore" on the analysis page.

- [ ] **Chat and answers for audits** `P2`
  - **Context:** create analyses have `TicketChat` and structured answers; audits show the proposed ticket's questions read-only and cannot be re-run in place.
  - **Fix:** generalise `refineTicket` and `answerQuestions` to accept the audit kind (pass refinements and answers to `auditIssue`), and show `TicketChat` in `AuditView`.

- [ ] **Show progress during an analysis** `P2`
  - **Context:** an analysis takes 10–40 s inside a server action, and the user only sees a pending message.
  - **Fix:** stream step updates (reading code, related issues, drafting, validating) and render them as a checklist. If runs approach `maxDuration` (300 s), move to Vercel Workflow or Queues and poll the row status.

## P3 · Harden and validate

- [ ] **Content Security Policy** `P3`
  - **Context:** `next.config.ts` sets basic security headers but no CSP.
  - **Fix:** add a nonce-based CSP in `src/proxy.ts`, allowing only self and the needed origins; test in report-only mode first.

- [ ] **Usage limits and rate limiting** `P3`
  - **Context:** every analysis, refinement and answer round spends model tokens, with no cap per organization.
  - **Fix:** count runs and tokens per organization per month (from the `analysis` table), refuse new runs over a configurable limit with a clear message, and add a per-user rate limit (for example 10 runs per minute).

- [ ] **Email verification, invitations and password reset** `P3`
  - **Context:** no email provider exists, so accounts are unverified and invitation links are the only secret.
  - **Fix:** add an email provider (Resend or another Marketplace integration), enable Better Auth `emailVerification` and `sendResetPassword`, require verified email to accept invitations, and set `sendInvitationEmail` in the organization plugin.

- [ ] **Error monitoring and structured logging** `P3`
  - **Context:** failures are only `console.error` calls (OAuth callbacks, resource listing, publishing).
  - **Fix:** add Sentry (or similar) for server and client errors, and a small logger that tags organization, analysis and provider ids without logging tokens or source code.

- [ ] **Bring-your-own AI key per organization** `P3`
  - **Context:** some customers will not accept code going to our provider account (see the data-flow page in [`TODO-NON-CODE.md`](TODO-NON-CODE.md)).
  - **Fix:** let an organization store its own provider key (encrypted like tokens) and use it for its analyses. Optional; build only if discovery asks for it.

- [ ] **Analysis history and usage metrics** `P3` `E5`
  - **Context:** there is no view across projects, and no data on how often drafts are published unchanged; the concierge pilot needs both.
  - **Fix:** add an organization-wide analysis list with filters, and track publish rate and edits before publish.
