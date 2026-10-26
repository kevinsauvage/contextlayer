# Project audit (2026-10-26)

Status: **point-in-time review**, not a decision. Nothing here is accepted until it is recorded in [`../../DECISIONS.md`](../../DECISIONS.md) or filed in a `TODO-<KIND>.md`.

Scope: the whole repository, reviewed to rethink the project. The product docs were treated as claims to check against the code, not as facts. When the review was done the app had only run locally, with no data to keep. It is now planned as a proper, production-grade product; the public portfolio demo will be a separate clone made later. Every recommendation below was re-checked against that (see section 1.2). The first version of this review assumed "local only" and recommended deleting auth, OAuth and the GitHub App; that recommendation is withdrawn.

## Method and limits

- **Read in full:** `src/core`, `src/features`, `src/integrations`, `src/infrastructure`, `src/lib`, `src/app`, `src/components` (except `ui/`, which was skimmed), `tests/evaluation`, `tests/helpers`, `scripts`, CI workflows, root config.
- **Run:** `pnpm test` (229 passed), `pnpm lint` (clean), `pnpm knip` (clean), `pnpm build` (clean, no warnings), `pnpm audit --prod` (2 findings), `pnpm outdated`.
- **Executed:** `extractTerms` on English and French requests (finding B3).
- **Not done:** `pnpm eval` (costs tokens), running the app in a browser, measuring analysis latency or cost, reading `.env.local`.
- Every other finding comes from reading the code and checking the installed Next.js and AI SDK docs under `node_modules`. Where a finding depends on behavior I did not execute, it says so.

## Summary

The code quality is high: strict TypeScript, enforced layers, Zod at every boundary, PGlite integration tests, a tenant-isolation test, prompt-injection fixtures. The problems are:

1. **Production readiness.** About 35% of `src/` is multi-tenant and OAuth plumbing. For a deployed product it is justified, but the app has no usage cap and no production setup yet (section 1.2).
2. **The "better than generic AI" claim is weakly evidenced.** The baseline in the evaluation is a straw man and the fixtures do not exercise production retrieval. It is the product's central claim, so it should hold up.
3. **Retrieval has logic flaws** and is a large hand-rolled subsystem.
4. **Long model calls run inside Server Actions**, which drives a lot of recovery machinery.

## 1. Rethink the scope

### 1.1 Multi-tenant plumbing is a third of the code

`docs/product/phase-0-decision.md` says the project is still asking "is this worth building?": C1 (interviews) and C2 (better than generic AI) are unmet, and no interviews exist. The code already contains organizations, invitations, roles, two OAuth integrations and encrypted token rotation.

Measured by line count (files for auth, organizations, providers, connections, OAuth routes, their UI and tests):

| Part                 | Lines  | Share of its total |
| -------------------- | ------ | ------------------ |
| `src` plumbing       | ~3,244 | ~35% of ~9,370     |
| `tests` for the same | ~831   | ~25% of ~3,287     |

Subsystems involved: `better-auth` with the organization plugin, the GitHub App (`integrations/github/*`), Atlassian OAuth (`integrations/jira/oauth.ts`, `provider.ts`), `features/integrations/*` (token refresh with row locks, `grantId`, `exclusiveKey`), `signed-state.ts`, `crypto.ts`, `features/organizations/*`, `proxy.ts`, the `settings/*`, `invitations`, `onboarding` and `projects/new` pages, and the matching components.

It is a lot of code to maintain, and it is the part of the app a stranger can attack. For a deployed multi-user product it stays.

### 1.2 What deployment changes

The earlier "local-first" alternative (no auth, local checkout, Jira API token, PGlite) is withdrawn: a public site cannot read a local checkout, and PGlite is a local file database. What applies instead:

| Gap                            | Evidence                                                                                                                                                                                                                                   | Needed                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Anyone can spend your AI quota | Sign-up is open (`src/infrastructure/auth/auth.ts:18`, no verification, no sign-up limit) and nothing caps analyses per user (`TODO-FEATURE.md`, "Usage limits and rate limiting").                                                        | A per-user and global cap on analyses and tokens, before the site is public.                                           |
| Sign-in abuse limits           | The built-in rate limiter keeps its counters in a `Map` in memory by default (`node_modules/better-auth/dist/api/rate-limiter/index.mjs:6`), which does not hold across several serverless instances.                                      | Configure database storage for the limiter, and consider email verification.                                           |
| Database connections           | `postgres(..., { max: 10 })` per process (`src/infrastructure/db/client.ts:11`).                                                                                                                                                           | Use the host's pooled connection string and a low `max`, then test under a few concurrent requests.                    |
| URLs and apps                  | OAuth redirect URIs are built from `BETTER_AUTH_URL` (`src/features/integrations/oauth-flow.ts:13`). The GitHub App and the Atlassian app must accept users other than you (not verified here: check each provider's visibility settings). | Register production callback URLs, make both apps usable by other accounts, rotate every secret that was used locally. |
| Stored customer content        | Analyses store code excerpts and Jira text in `analysis.result`, sent to the AI provider.                                                                                                                                                  | A short privacy and data-flow page, and a way to delete a project and its analyses (project deletion exists).          |
| Observability                  | Failures are `console.error` only.                                                                                                                                                                                                         | Error monitoring, so you see failures visitors hit.                                                                    |

What stays from the first review: the bug list, the retrieval changes, the evaluation fixes, and moving long model calls off Server Actions.

Dropped: removing `better-auth`, `octokit`, `postgres`, Docker, `access.ts`, `signed-state.ts` and `crypto.ts`. The local git source stays, but only for development and evaluations (no production use).

### 1.3 The evidence for "better than generic AI" is weak

- The baseline in `tests/evaluation/baseline.eval.ts` receives only the ticket title (`prompt: c.title`) and no repository.
- The judge prompt scores `evidenceTraceability` as "text without citations scores 0", so the baseline loses that criterion by construction.
- The realistic competitor is an agent with repo access and a Jira MCP server. The reported 45 vs 12 vs 11 scores cannot support C2.

**Action:** run a repo-aware agent plus Jira MCP on the same fixtures as a zero-code baseline, before building more.

### 1.4 The evaluation does not exercise production retrieval

- Fixtures use `DirectorySource`, which scores every file with all terms. Production uses `GithubSource`, which runs code search on at most 3 terms (`src/integrations/github/source.ts:8,102`).
- The fake tracker in `tests/evaluation/fixtures.ts` returns all related issues regardless of the query, so Jira search is never exercised.
- Fixture repos are 2 to 4 files, so recall is trivially high (`retrievalRecall` in `tests/evaluation/draft-case.ts`).
- `DirectorySource` documents itself as mirroring the GitHub source's order. It does not.
- `docs/product/evaluation-rubric.md` says the judge "cannot read the repository", but `buildJudgePrompt` passes it the repository files. The docs are stale on this point.

## 2. Bugs and logic issues

Severity is my estimate. "Read" means found by reading, "ran" means executed.

### Retrieval

- **B1 (high, read): a failed query expansion kills the whole analysis.**
  - `src/core/context/gather.ts:28` awaits the expander with no try/catch.
  - `termsSchema` in `src/integrations/ai/generator.ts:23` is strict (`.min(5).max(10)`). A model returning 4 or 11 terms throws `NoObjectGeneratedError` and fails the run.
  - Expansion is an enhancement. On failure it should fall back to the heuristic terms.
- **B2 (high, read): the Jira search is also fatal.** It runs in `Promise.all` with file retrieval (`gather.ts:30-33`). A JQL or network error fails the analysis.
- **B3 (medium, ran): non-English requests produce noise terms.** `extractTerms("Ajouter un bouton pour exporter les commandes en CSV sur la page des commandes")` returns `["commandes","ajouter","bouton","pour","exporter","les","csv","sur","des"]`. Stopwords and synonyms in `src/core/context/terms.ts:6-83` are English only. Matching is by substring, so "les", "des", "est" and "sur" match almost every file.
- **B4 (medium, read): expanded terms never reach GitHub code search.** `mergeTerms` appends them after the heuristic terms (`terms.ts:106-121`) and `searchContent` keeps only the first 3 (`github/source.ts:100-102`). Only path scoring benefits from the expansion.
- **B5 (medium, read): related-issue search is broad.** `text ~ a OR text ~ b …` over every term (up to 18 plus synonyms), ordered by `updated DESC`, limit 5 (`jira/client.ts:120-128`). It returns recently updated issues matching any term, not the best matches.
- **B6 (low, read): `parseAliasConfig` ignores `extends`** (`src/core/context/paths.ts:61-76`), so monorepo path aliases defined in a base config are not resolved.

### Evidence and prompt

- **B7 (medium, read): validation is referential only.** `validateEvidenceReferences` (`src/core/evidence/validate.ts:41-63`) checks that cited ids exist and that `verified` claims cite something. It never checks that the excerpt supports the claim.
  - Cheap deterministic check: every backticked identifier or quoted string in a `verified` claim must appear in a cited excerpt.
- **B8 (low, read): escaping alters code.** `asText` replaces every `<` with `&lt;` (`src/integrations/ai/prompt.ts:7,60`). JSX and generics reach the model altered while the prompt asks it to quote exactly. A random per-request boundary avoids this.
- **B9 (medium, read): retrieval candidates are not persisted.** `draftFromRequest` returns only `{ result, issues, usage, revision }` (`src/features/ticket-creation/actions.ts:39`). When a run misses a file you cannot see what was retrieved.
- **B10 (medium, read): a malformed model response is not retried.** `AiGenerator.run` (`generator.ts:50-58`) has no retry or repair and no `timeout` (the AI SDK supports `timeout`). A hung provider blocks the action until the 10 minute stale rule.

### Jira

- **B11 (low-medium, read): ADF to text drops content.** `adfToText` (`src/integrations/jira/adf.ts:42-51`) loses `mention`, `status`, `emoji` and `date` nodes, and table cells are concatenated with no separator. Audits of tickets using them see damaged text.
- **B12 (low, read): no timeout or 429 handling** in `jiraRequest` (`jira/client.ts:64-76`).

### UI and data

- **B13 (medium, read): autosave fails silently.** `src/components/analysis/draft-workspace.tsx:96` ignores the action result. `createItem` in `draft-editor.tsx` returns empty items, which fail `draftBodySchema` (`text.min(1)`), so nothing is saved, with no indicator, until every field is filled.
- **B14 (low-medium, read): autosave and redraft share the client action queue.** The Next.js docs (`server-actions.md`, "Sequential dispatch on the client") state that actions are dispatched one at a time. A stale autosave can run after a redraft finishes and write old edits over the new draft.
- **B15 (low, read): `restartAnalysis` overwrites `createdByUserId`** (`src/features/analysis/run.ts:114`), losing the original author.
- **B16 (low, read): the dark theme is unreachable.** Nothing sets `.dark` (no provider, no toggle), so the dark variables in `globals.css` and every `dark:` class in `components/ui` are inert.

## 3. Next.js and React

Keep: App Router, `proxy.ts` as an optimistic check plus `requireOrgContext` in every page (matches the Next auth guide), the typed `PageProps`/`RouteContext` helpers, `React.cache` for request dedupe, direct Drizzle queries in Server Components, Zod at boundaries, everything dynamic (correct for authenticated pages, no cache components needed).

Change:

- **Long model calls run inside Server Actions.** `startAnalysis` awaits the whole run (`src/features/analysis/run.ts:76-94`, `ticket-creation/actions.ts:54-61`). `PRODUCT.md` states 8 to 20 seconds (not measured here).
  - Cost: the client queue blocks (B14), the page shows no progress, a closed tab loses the redirect, and the lease, stale-run and run-token machinery exists to recover from dead requests.
  - Options: `after()` (available in Next 16.4, `after.md`) plus a polling status page, or stream a partial object with the AI SDK.
- **Refinement wipes manual edits.** Each chat message re-runs the whole pipeline and discards edits. That is why `DiscardEditsConfirm`, `RefinementProvider`, autosave, `editedResult` and `saveDraftEdits` exist. Passing the current draft into the redraft prompt makes edits an input and removes that flow.
- **The resource picker uses a client `fetch` plus a route handler** (`resource-picker.tsx`, `app/api/integrations/connections/[connectionId]/resources/route.ts`). A Server Component with Suspense replaces both.
- Keep `export const maxDuration = 300` in `analyses/[analysisId]/page.tsx:27` and `projects/[projectId]/page.tsx:19`. It has no effect when run locally, but a serverless host cuts a Server Action off at this limit, and `after()` callbacks use the same limit (`after.md`). Check that 300 s is allowed on the chosen plan.
- `next.config.ts:15-20` uses `@tailwindcss/turbopack`. The Next docs (`11-css.md`) document `@tailwindcss/postcss`. It builds, but it is off the documented path.
- Three `as Route` casts (for example `auth-form.tsx:19,71`) bypass `typedRoutes`.
- No `global-error.tsx`. `(app)/error.tsx:10` tells users to contact "support", which does not exist.
- Env is validated lazily in `getEnv()`, so a bad config surfaces on the first request. `instrumentation.ts` validates at startup.

## 4. Complexity and duplication

- **Retrieval is 544 lines of hand-rolled code** in `src/core/context/`: regex import graphs for JS, Python and Go, a homemade JSONC parser, an alias resolver, English stopwords and synonyms, substring scoring.
  - Before deleting it, try agentic retrieval: an AI SDK tool loop with `search_code` (`git grep`), `read_file` and `search_issues`, where the tool wrapper mints evidence ids so citations stay checkable.
  - Measure it against the existing `retrievalRecall` and judge harness on at least one real repository. Token cost and latency will rise, so measure both.
- **Layer rules are enforced twice.** `tests/unit/architecture.test.ts` (86 lines of regex) duplicates the `no-restricted-imports` rules in `eslint.config.mjs`. Keep one.
- **`DirectorySource` is used only by tests and evals** but lives in `src/integrations/filesystem/`. Its `TEXT_EXTENSIONS` list differs from `github/source.ts:10`.
- **Dead compatibility code** for data that only exists locally: the legacy `title` input (`src/core/analysis/schemas.ts:11`, `src/features/analysis/input.ts:15`) and eight migrations including three backfills (`drizzle/0003` to `0005`). Do this once, before the first production deploy: regenerate one clean migration. After the deploy, migrations must only be added.
- **`pricing.ts` is a hand-kept price table** "as of 2026-10-26". It will rot, and once the site is public, cost per analysis feeds the usage caps. The AI Gateway returns cost in its response metadata. Otherwise store tokens and compute dollars when reporting.
- **`core` is not fully pure.** `src/core/integrations/provider.ts:20-39` holds a GitHub-style `#subdirectory` convention.

## 5. Dependencies and packages

| Finding                                                                                 | Action                                                                                                                            |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `shadcn` is in `dependencies` but is a CLI used for one CSS import                      | Move to `devDependencies`. It causes the high `pnpm audit` finding (`body-parser` via `@modelcontextprotocol/sdk` and `express`). |
| `esbuild` moderate finding via `better-auth` and `drizzle-kit`                          | Update `better-auth`; re-run `pnpm audit --prod`.                                                                                 |
| `parseJsonc` in `paths.ts:26-58`                                                        | `jsonc-parser`, or `get-tsconfig`, which also handles `extends`.                                                                  |
| English stopword and synonym lists                                                      | Delete; the LLM expansion covers it.                                                                                              |
| `DirectorySource.walk` (development and evals only)                                     | `git ls-files`.                                                                                                                   |
| `architecture.test.ts`                                                                  | `eslint-plugin-boundaries` or `dependency-cruiser`, or just ESLint.                                                               |
| No prompt inspection tooling                                                            | `@ai-sdk/devtools` (documented in `node_modules/ai/docs/03-ai-sdk-core/65-devtools.mdx`, local only).                             |
| `EditableList` + `DraftEditor` (~300 lines of list state)                               | Optional: `react-hook-form` with `useFieldArray`.                                                                                 |
| Patch updates pending: `next`, `ai`, `better-auth`, `@ai-sdk/openai-compatible`, `knip` | Apply before the first deploy, and add `pnpm audit --prod` to CI. These are now production dependencies.                          |

Checked and fine: `cn` is the shadcn team's own replacement for `clsx` plus `tailwind-merge`. `supportsStructuredOutputs: false` makes the openai-compatible provider send `json_object` without the schema, so `withSchemaInstruction` is needed, not redundant.

## 6. Suggested order

The backlog was re-ordered on 2026-10-26 to build this app properly. The public portfolio demo will be a separate clone made when this app is finished (see "Demo clone" in `TODO-NON-CODE.md`), so nothing in this repository is built for it. Priorities:

- **P0, core promise:** a draft must be correct and a run must not fail for avoidable reasons.
- **P1, prove it:** fair evaluation, retrieval measured on real code, and the remaining correctness bugs.
- **P2, production-grade:** deploy, security, usage limits, monitoring, background runs.
- **P3, polish and later.**
- **Deferred:** business validation (interviews, competitor pricing, pilot, go / pivot / stop log) and the demo clone.

Order of work:

1. B1 and B2 (a failed helper step aborts the run), B10 (no timeout or retry), B4 and B3 (search terms), and the quote check for `verified` claims.
2. The fair baseline, fixtures that exercise real retrieval, the local git source, and the retrieval recall measurement on this repository. Then the P1 correctness bugs.
3. Production-grade work. Do the migration squash and dependency fixes before the production database exists.
4. Polish: redrafts that keep edits, audits with chat, theme toggle, and the optional experiments.

## 7. Assumptions

These were not confirmed with the owner and are easy to reverse:

- Business validation is deferred, not needed to build the product.
- The deployed product keeps real GitHub and Jira connections, organizations and roles.
- AI usage is paid by whoever runs the instance, and is capped.
