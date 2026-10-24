# TODO

Only open work is listed; finished work lives in `git log` and `DECISIONS.md`. Markers: `[ ]` open, `[~]` partly done (the remaining scope is described). Each item says why it matters (**Context**) and how to close it (**Fix**).

## P0: Decide whether to build (Phase 0)

- [~] **Customer discovery: run 8 to 12 interviews** (E4)
  - Context: the guide is ready (`docs/product/customer-discovery.md`) but no interview has happened, so criteria C1 (a real, costly problem) and C6 in `docs/product/phase-0-decision.md` have no evidence.
  - Fix: recruit engineering managers and product owners at agencies and product teams, run the guide, fill the synthesis template after each batch of four, and update H1, H5 and H9 in `business-hypotheses.md`.
- [~] **Competitor research: hands-on comparison**
  - Context: only a desk pass exists (`docs/product/competitor-research.md`); C6 needs proof that a differentiator survives against platform features.
  - Fix: run Rovo, Rovo Dev, Linear Agent and Scrummy on the four fixture repositories, score them with `docs/product/evaluation-rubric.md`, record pricing, and note whether any of them labels unverified claims.
- [ ] **Log the go / pivot / stop decision**
  - Context: `phase-0-decision.md` fixes the criteria in advance, and its decision log is empty.
  - Fix: after E3 (blind review) and E4 (interviews), update the criteria table, apply the rule written there, and add a dated row to the log.
- [ ] **Reconcile `docs/product/plan.md` with the original v0.2 planning document**
  - Context: the plan was rewritten during the prototype; the original may hold scope or metrics that were dropped silently.
  - Fix: if the v0.2 document still exists, diff the scope, metrics and risks, then merge or explicitly drop each difference in `plan.md`. If it does not exist, delete this item.

## P1: Prove the product

- [~] **Baseline comparison: unbiased judge and blind human scoring** (E2, E3)
  - Context: `tests/evaluation/baseline.eval.ts` scores original vs generic AI vs ContextLayer. The judge now reads the fixture repository as the source of truth, and drafts are regenerated in the same run (`tests/evaluation/draft-case.ts`). Result 2026-10-24: 45 vs 12 vs 11 of 48, with `deepseek-v4-pro` judging `deepseek-flash` (same vendor).
  - Fix: optionally rerun with a judge from another vendor. Then score the four packets in `tests/evaluation/review/` into `scores.json`, run `pnpm review:report`, and update E2/E3 in `validation-experiments.md`.

- [ ] **Grow the fixtures from 4 to 8–10**
  - Context: `tests/fixtures/` has four miniature repositories; C3 asks for 8 to 10, and there is no case with a Jira issue or a duplicate ticket.
  - Fix: add `case.json` plus `repo/` for a Jira-issue audit, a duplicate-ticket case, the "banner title" miss (copy in an imported content module), a multi-paragraph request, and a prompt-injection file. `tests/unit/fixtures.test.ts` validates the shape.

- [ ] **Assert forbidden claims and must-stay-uncertain facts in `analysis.eval.ts`**
  - Context: each `case.json` lists `forbiddenClaims` and `mustStayUncertain`, but the eval only asserts that evidence references are valid, so C3 (no fabricated claim) is unchecked.
  - Fix: add an LLM-judge step (with the separate judge model) that checks each forbidden claim is absent and each uncertain fact is not marked `verified`; fail the case and write the verdict to `results/<case>.json`.

- [ ] **Evaluate the clarification loop**
  - Context: answers to open questions regenerate the draft (`answerQuestions`, `<answers>` in `src/integrations/ai/prompt.ts`), but nothing checks that the model applies them.
  - Fix: add eval cases with prepared answers. Assert that answered questions disappear from `openQuestions`, that the answer shows up in the description or criteria, and that a blank answer keeps its question open.

- [~] **Pick the default model**
  - Context: DeepSeek-V4.1-Flash and DeepSeek-V4-Pro were compared on 2026-10-24 (see E2 in `validation-experiments.md`). Flash scored 45/48 against Pro's 44, at 8 to 14 s instead of 29 to 51 s and about half the output tokens. Flash is the generator and Pro the judge.
  - Fix: compare one model from another vendor through the AI Gateway (as generator, and as judge to remove same-vendor bias); add cost per draft once prices are recorded (see "Cost per analysis").

- [ ] **Cost per analysis** (H7, C5)
  - Context: the `analysis` row stores input and output tokens and the model, but no price, so H7 (a few cents per analysis) cannot be tested.
  - Fix: add a per-model price table (input and output per million tokens) in `src/core` or the env, compute cost in `startAnalysis` / `restartAnalysis`, store it in a new `cost_usd` column, and show it next to the token counts on the analysis page.

- [ ] **Retrieval: query expansion with the model** (E6)
  - Context: `extractTerms` relies on keywords plus a hand-written synonym map, and still misses `mail/send.ts` for "Add password reset". Embeddings are deferred until measured.
  - Fix: before retrieval, ask a small model for 5–10 code-search terms (identifiers, file names) from the request and merge them with `extractTerms`. Measure recall on the fixtures and on two real repositories (E6), and consider embeddings only if recall stays under 90%.

- [ ] **Import following beyond JS/TS aliases**
  - Context: `resolveImports` in `src/core/context/imports.ts` only resolves relative, `@/` and `~/` imports, assuming `@/` means `src/`.
  - Fix: read `compilerOptions.paths` from the repository's `tsconfig.json` when it exists, and add resolvers for Python (`from x import y`) and Go packages before relying on it in those stacks.

- [ ] **Large repositories**
  - Context: `GithubSource.listFiles` uses one recursive tree call, which GitHub truncates at about 100,000 entries or 7 MB; monorepos have no scoping, and latency on big repositories is unmeasured.
  - Fix: detect `truncated` in the tree response and fall back to paginated directory reads; add an optional subdirectory to the project (`source_resource_id` like `owner/repo#apps/web`); measure latency on a repository of about 1,000 files and record it in `phase-0-feasibility.md`.

## P2: Connect and deliver

- [~] **Full flow with real credentials**
  - Context: connect, create a project, draft and publish work on the dev GitHub App and Jira site (KAN-4).
  - Fix: run an audit and apply it to a real issue, and run one clarification round end to end. Note anything that breaks in `phase-0-feasibility.md`.
- [~] **Integration failure tests**
  - Context: tenant isolation, the refresh-token race, rejected refresh tokens and connections in use are covered; GitHub and Jira API errors are not.
  - Fix: add tests with a stubbed `fetch`/Octokit for a revoked GitHub installation, a 401 from Jira on a fresh token (mark `needs_reconnect`), a deleted Jira project, and the server actions' error returns.
- [ ] **Member role changes and invitation emails**
  - Context: invite, remove and rename exist (`/settings/organization`); roles cannot be changed, and invitations are copied as links because there is no email provider.
  - Fix: add a role select per member that calls `authClient.organization.updateMemberRole` (owner and admin only); once an email provider exists, set `sendInvitationEmail` in the Better Auth organization plugin.
- [ ] **Leave or delete an organization**
  - Context: users can create and switch organizations but not leave or delete one.
  - Fix: add a danger zone to `/settings/organization` with "Leave" (`authClient.organization.leave`, blocked for the last owner) and "Delete" for owners (`authClient.organization.delete`; projects and connections cascade). Confirm with the typed organization name.
- [ ] **Second providers to prove the seam**
  - Context: the registry (`src/integrations/registry.ts`) has only GitHub and Jira, so the generic design is untested. A proposed session for Linear is waiting.
  - Fix: implement Linear as a `TrackerProvider` and GitLab as a `SourceProvider` (OAuth, resource listing, adapter, Zod-validated responses, unit tests). No UI change should be needed; if one is, fix the seam instead.
- [ ] **Edit a project**
  - Context: changing the repository or tracker project means deleting and recreating the project, which loses its analysis history.
  - Fix: add a project settings page that reuses `ResourcePicker` and an `updateProject` action, validating the new resources the same way `createProject` does.
- [ ] **Keep manual draft edits**
  - Context: edits in the Edit tab live in client state until publish; a re-run, an answer round or a page reload loses them.
  - Fix: autosave `editedResult` with a debounced server action. When `editedResult` exists, ask for confirmation before "Run again" or "Update ticket" replaces it.
- [ ] **Draft versions**
  - Context: re-runs overwrite `result` in place, so a worse redraft cannot be undone.
  - Fix: add an `analysis_version` table (analysis id, input, result, created at) written by `restartAnalysis` on re-run, and a version list with "Restore" on the analysis page.
- [ ] **Clarification loop for audits**
  - Context: audits show the proposed ticket's open questions read-only, and cannot be re-run in place.
  - Fix: generalise `answerQuestions` and `redraft` in `src/features/ticket-creation/actions.ts` to accept the audit kind (pass the answers to `auditIssue`), and show `ClarifyQuestions` in `AuditView`.
- [ ] **Progress while analyzing**
  - Context: an analysis takes 10–40 s inside a server action, and the user only sees a static message.
  - Fix: stream step updates (reading code, related issues, drafting, validating) from the pipeline and render them as a checklist. If runs approach `maxDuration` (300 s), move to Vercel Workflow or Queues and poll the row status.
- [ ] **First CI run on GitHub**
  - Context: `.github/workflows/ci.yml` mirrors `pnpm check` but has never run on GitHub.
  - Fix: push a branch, fix anything environment-specific (the `pnpm setup` secrets, build env), then make the workflow a required check on `main`.
- [ ] **Hosting and deploy**
  - Context: the app only runs locally; there is no production database, env or migration step.
  - Fix: pick a host (Vercel with managed Postgres from the Marketplace fits the stack), document production env vars, run `drizzle-kit migrate` as a deploy step, and register the production callback URLs with GitHub and Atlassian.

## P3: Harden and validate

- [ ] **Threat model**
  - Context: prompt injection through repository and Jira text, tenant isolation, and token handling are mitigated piecemeal (see "Security model" in `docs/architecture/overview.md`) but never reviewed as a whole.
  - Fix: write `docs/architecture/threat-model.md` (assets, actors, entry points, mitigations, gaps) and turn every gap into a TODO item.
- [ ] **AI regression coverage**
  - Context: no test checks that injected instructions in repository content are ignored, and `pnpm eval` is too slow and costly for CI.
  - Fix: add fixtures with files that say "ignore your instructions" or try to set claim statuses; assert the draft does not follow them. Add a two-case eval subset that CI can run nightly with a cheap model.
- [ ] **Usage limits and rate limiting**
  - Context: every analysis, re-run and answer round spends model tokens, with no cap per organization.
  - Fix: count runs and tokens per organization per month (from the `analysis` table), refuse new runs over a configurable limit with a clear message, and add a per-user rate limit (for example 10 runs per minute).
- [ ] **Email verification and password reset**
  - Context: no email provider exists, so accounts are unverified and invitation links are the only secret.
  - Fix: add an email provider (Resend or another Marketplace integration), enable Better Auth `emailVerification` and `sendResetPassword`, require verified email to accept invitations, and send invitations by email.
- [ ] **Error monitoring and structured logging**
  - Context: failures are only `console.error` calls (OAuth callbacks, resource listing, publishing).
  - Fix: add Sentry (or similar) for server and client errors, and a small logger that tags organization, analysis and provider ids without logging tokens or source code.
- [ ] **Content Security Policy**
  - Context: `next.config.ts` sets basic security headers but no CSP.
  - Fix: add a nonce-based CSP in `src/proxy.ts`, allowing only self and the needed origins; test in report-only mode first.
- [ ] **Narrower Jira scopes**
  - Context: `src/integrations/jira/oauth.ts` requests `read:jira-work` and `write:jira-work`, which grant broad access.
  - Fix: switch to granular scopes (read issues and projects, write issues only), update the Atlassian app permissions, and check that search, create and update still work.
- [ ] **Customer-facing data-flow description**
  - Context: source code and Jira text go to the AI provider; customers will ask where and for how long.
  - Fix: write a public page covering what is read, sent, stored and for how long; link each provider's retention terms; optionally support bring-your-own-key per organization.
- [ ] **Raise the coverage floor**
  - Context: coverage is about 50% of statements against a 40% floor; feature actions, the OAuth flow and integration error paths are the weak spots.
  - Fix: add tests for `finishConnect`, `createProject`, `answerQuestions` and the error paths above, then raise the floor in `vitest.config.mts` to the new level minus a small margin.
- [ ] **Analysis history, usage metrics, then a concierge pilot** (E5)
  - Context: there is no view across projects, and no data on how often drafts are published unchanged.
  - Fix: add an organization-wide analysis list with filters, track publish rate and edits before publish, then run a two- to four-week pilot with one team and report the results in `validation-experiments.md`.
