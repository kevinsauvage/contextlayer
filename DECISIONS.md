# Decisions

Format: date · decision · why. Newest group last. Open questions are at the top.

## Open

- AI model choice: compare quality and cost on paid mid-tier models with a separate judge model (`pnpm eval`).
- Hosting and background job mechanism: analyses run inside the server action (`maxDuration = 300`); revisit when pilot data shows requests near the limit.
- Narrower Jira scopes than `write:jira-work`.

## Foundations (2026-10-22)

- Next.js App Router, strict TypeScript, Tailwind, shadcn/ui, Zod, Vitest, pnpm · plan-mandated stack; pnpm is the package manager.
- Modular monolith; no worker, broker or vector database until a measured need · keep operations simple until data says otherwise.
- Evidence validation is separate from schema validation (`src/core/evidence/validate.ts`) · a schema-valid draft can still cite nothing.
- Claim statuses `verified | inferred | unknown | needs_clarification`; no confidence percentages · a number invites false precision.
- The model cites candidate evidence ids and never writes evidence itself; the pipeline attaches the real excerpts · prevents fabricated sources.
- Retrieval v1 is keyword scoring (path ×3 + content) over a `ContextSource`; no embeddings until recall measurements justify them.

## Dependency pins (2026-10-22)

- TypeScript stays on 5.x (7.x is not supported by typescript-eslint yet), ESLint on 9.x (follows eslint-config-next), `@types/node` on 24 (matches the Node 24 runtime). Revisit when the tooling catches up.

## AI provider (2026-10-22 to 2026-10-23)

- AI SDK 7 + Vercel AI Gateway (`AI_MODEL` is a `provider/model` string, default `anthropic/claude-sonnet-5.5`) · swappable models for the cost and quality comparison; no provider package.
- `AI_BASE_URL` + `AI_API_KEY` route the same code to any OpenAI-compatible endpoint (Gemini free tier, Groq, OpenRouter, Ollama, DeepSeek); the gateway stays the default when `AI_BASE_URL` is unset.
- `AI_STRUCTURED_OUTPUTS=false` falls back to JSON mode with the schema appended to the instructions · endpoints like DeepSeek reject `json_schema`; Zod still validates the output.
- The baseline eval scores original / generic AI / ContextLayer with an LLM judge against fixture ground truth · cheap and repeatable; biased when the judge is the generating model, so results are directional until a separate judge and human scoring exist.
- OpenCode Go is not used for the app · its terms limit it to coding-agent traffic and require a session header.

## Real integrations (2026-10-22)

- Postgres + Drizzle ORM (postgres-js); PGlite runs the same migrations in integration tests.
- Better Auth (email and password) with the organization plugin: an organization is the tenant boundary; every query is scoped by `organizationId`.
- GitHub App (read-only Contents and Metadata). The install callback exchanges the OAuth `code` and checks the user's installations, because `installation_id` in the URL is attacker-controlled.
- Jira Cloud via OAuth 2.0 (3LO); tokens AES-256-GCM encrypted with `ENCRYPTION_KEY`. Publishing creates a Task (else the first non-subtask type); audit "apply" overwrites summary and description.
- OAuth states are HMAC-signed, bound to user and organization, valid 10 minutes.
- Retrieval: path scoring + GitHub code search (best effort) → read top 20 → rescore → 8 candidates; related Jira issues via JQL `text ~`.
- Cache Components and partial prefetching are disabled: the app is authenticated and dynamic.
- Analyses run synchronously in the server action (no job infrastructure until workload data says otherwise).

## Engineering standards (2026-10-23)

- Extra strict TypeScript (`noUncheckedIndexedAccess`, `noImplicitReturns`, `noUnused*`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`) · indexing bugs surface at compile time; `first()` replaces non-null assertions.
- ESLint `strictTypeChecked` + `stylisticTypeChecked` with zero warnings, and `no-restricted-imports` per layer plus `import/no-cycle` · AGENTS.md says dependencies point inward; the linter now enforces it. `core` may import only `core` and `zod`.
- `consistent-type-definitions: type` · the codebase derives types from Zod and uses type aliases throughout.
- Prettier (120 columns, Tailwind class sorting), `src/components/ui` excluded · the shadcn CLI regenerates those files in its own style.
- knip fails on unused files, exports and dependencies · enforces "no dead code". Unused shadcn components (`select`, `separator`, `skeleton`, `tabs`) were deleted; add them back with the CLI when needed.
- Vite's native `resolve.tsconfigPaths` replaces `vite-tsconfig-paths`; Vitest configs are `.mts` to avoid the CJS config loader warning.
- Blank `KEY=` values in `.env.local` count as unset (`parseEnv`) · copying `.env.example` unchanged used to crash on `AI_BASE_URL=`.
- `pnpm setup` generates `BETTER_AUTH_SECRET` and `ENCRYPTION_KEY` and never overwrites an existing `.env.local`.
- Pre-commit runs lint-staged (simple-git-hooks); CI runs the same gates as `pnpm check` plus coverage with a 40% floor (current coverage is about 44%; ratchet it up as tests are added).
- `typedRoutes` enabled and baseline security headers (`nosniff`, `X-Frame-Options: DENY`, referrer and permissions policies) set in `next.config.ts`; CSP deferred.
- Dependabot weekly, minor and patch grouped.
- A new session defaults its active organization to the user's oldest membership (Better Auth `session.create.before` hook) · without it every sign-in landed on onboarding and created another organization.
- Linking a GitHub installation that already belongs to another organization is refused (`github=taken`) instead of silently doing nothing.

## Evaluation (2026-10-23)

- The evaluation judge is configured separately (`AI_JUDGE_MODEL`, `AI_JUDGE_BASE_URL`, `AI_JUDGE_API_KEY`, `AI_JUDGE_STRUCTURED_OUTPUTS`), each falling back to its `AI_*` counterpart · a judge must not grade its own output, and a DeepSeek-only base URL cannot serve a second provider. Results record `judgeModel` and `judgeIsGenerator`; the run warns when they match, so a same-model run cannot pass as clean.
- Human scoring uses packets generated from the last eval run (`pnpm review:export`), with a stable per-case A/B/C rotation and the mapping in a gitignored `blind-key.json` · the reviewer scores blind, and `pnpm review:report` writes `docs/product/e3-blind-review.md` so the evidence and the judge comparison are committed.

## Integrations, organizations and UX (2026-10-23)

- One `integration_connection` table plus a provider registry replace `github_installation` and `jira_connection` · adding a code host or tracker is one `SourceProvider`/`TrackerProvider` implementation; routes, storage, token refresh and UI stay generic. Migration `0003` backfills existing rows and projects before dropping the old tables.
- Projects store `{connection, resourceId, resourceLabel}` for source and tracker instead of provider columns, and analyses store `published_issue_url` · no Jira URL building outside the Jira adapter.
- `exclusive` providers (GitHub App installations) may belong to one organization; Jira sites may be shared · an installation grants repository access to whoever links it, a Jira site is gated by each user's own consent.
- Connections from one OAuth consent share a `grant_id`; refresh runs in a transaction that locks the grant's rows and re-reads the token · Atlassian refresh tokens rotate, and the old per-site copies broke each other.
- A refresh rejected with 400/401/403 marks the grant `needs_reconnect` and raises `ReconnectRequiredError`; transient failures do not · users see "Reconnect required" instead of an opaque 500.
- OAuth state is bound to the provider and carries a same-origin `returnTo` (`safePath`) · connecting from the project wizard returns to it; a GitHub state cannot complete a Jira callback.
- Callback URLs moved to `/api/integrations/<provider>/callback`; GitHub and Atlassian app settings must be updated.
- A connection used by a project cannot be disconnected; the UI names the projects · avoids dangling foreign keys without cascading deletes of analysis history.
- Organization switcher in the header, `/organizations/new`, and `/settings/organization` (rename, members, invites) use the Better Auth organization client · permissions stay enforced by Better Auth.
- Invites are copyable links (`/invitations/<id>`) because no email provider exists yet; the invitee must sign in with the invited email. Without email verification, the link is the secret · revisit with email verification (P3).
- A run still `running` 10 minutes after creation reads as failed (status and error are derived, the row is untouched) and a re-run may replace it · a killed request never reaches the execute-and-record step, and rendering a page should not write.
- `requireOrgContext` and `getSession` are wrapped in React `cache()` · layout and page shared one request but did two auth lookups.

## Retrieval and draft size (2026-10-23)

- Quoted text in a title is excluded from search terms, accents are folded, edit verbs ("change", "update", "rename"…) are stopwords, and a small UI synonym map expands terms ("banner" → hero, header) · "Change the banner title to "Hello…"" matched only `CookieBanner` and never read `Hero.tsx`. Still a stopgap for LLM query expansion (P1).
- GitHub code search runs one query per term (its API has no OR) and result order only decides which files to read; the shortlist is then ranked by path and content · joining terms with OR returned no hits, so a palette defined only in `src/styles/globals.css` was never read while `Overline.tsx` matched the word "line". Answer-only instruction words ("current", "line", "find", "other") are stopwords.
- The top three files' relative and `@/`/`~/` imports are followed one hop (and through barrel `index` files); modules named after an imported identifier rank first, and up to three are kept · copy and config usually live in a module whose name shares nothing with the title (`config/content/sections.ts`).
- The prompt scales the ticket to the change (a copy change: 1–2 claims, 1–3 criteria, usually no assumptions or questions), caps open questions at three, forbids mentioning what the context does not say, keeps the requester's wording in the title, and asks which part is meant when no source clearly matches · drafts were padded to fill every section and narrowed the target to a look-alike component.
- The create input is a request (up to 4,000 characters, multi-line), not a title · users give context, constraints and background; the model writes the ticket's own title and must carry every stated need into the draft. Stored as `input.request`; older rows with `input.title` are still read (`readAnalysisInput`). Requests longer than a title keep up to 10 search terms.
- Open questions are answered in place: answers are stored in `input.answers`, merged across rounds (`mergeAnswers`), fed to retrieval and to the prompt as `<answers>`, and the draft is regenerated in the same analysis. Blank answers keep the question open in the ticket · refining a whole request to answer one question was clumsy.
- A clarification round settles the answers: the regenerated draft asks at most one genuinely new product question, and never an investigation question (where a value lives, which components use it, how to compute it, who approves it) · a second round on the primary-ramp ticket produced three such follow-ups (which generator, who approves, which components use white text) and turned the ticket into research, although the palette file was already in context. On the same input the draft now asks one real decision and drops from 16.9k to 4.1k output tokens.

## Retrieval on a real repository (2026-10-24)

- Content relevance counts capped term occurrences instead of term presence, test paths are penalised, and up to 10 candidates are kept · on the portfolio, "make the primary color blue" and "add a testimonial" tied every component at the same score, so `globals.css` and the testimonials content module were cut in favour of cards and test files.
- Search stays one query per term and GitHub's order only decides what to read, but synonyms now cover theme and performance wording and generic qualifiers ("site", "too", "annoying") are stopwords · "add dark mode" on an already-dark site now finds `globals.css` and asks whether a light theme is meant, and "the site is too slow on mobile" no longer matches only the site-map route.
- A draft never restates the request as a claim, and no question may repeat what an assumption already settles · the mobile-performance draft marked its restatement `verified` with no evidence, and the testimonial draft asked where to place an entry it had already assumed was appended.
- The draft page defaults to a preview rendered from `ticketSections`, the same structure sent to the tracker, so what the user approves is what gets published; editing is a second tab, and publishing sits in a sticky bar.
- Open questions can carry two to four concrete `options` with one marked `recommended` and a one-sentence `recommendation`; the client renders them as radio choices next to the free-text field · a product decision should be answerable by picking a concrete option, not by writing prose, while a quote or a name still needs free text. Options are UI aids and are not published to the tracker.

## Correctness P1 (2026-10-23)

- A re-run moves the row to `running` with a conditional `UPDATE … WHERE status <> 'running'`; no updated row raises `AnalysisAlreadyRunningError` ("This analysis is already running") · the pre-check in `findRefinable` cannot stop two tabs from both spending tokens.
- `integration_connection.exclusive_key` (`provider:externalId`, null for shared providers) carries a unique index, and `saveAccounts` runs its pre-check and upserts in one transaction · the pre-check alone let two organizations link the same GitHub installation, and a mid-loop failure left a partial grant. Migration `0004` backfills existing GitHub rows.
- Server actions map known failures through `toActionError` / `withActionErrors` (`src/features/errors.ts`); `ForbiddenError` and `AnalysisAlreadyRunningError` live in `src/core/errors.ts` · a non-admin sees a message instead of the error page, and unknown errors (including `redirect`) still propagate.
- Analysis views use `safeParse` and render an "older version" state with the request edit form · one row written by an older schema used to crash the whole page.

## Structure P1 (2026-10-23)

- `ticketSections` returns items `{ status, text, url }` rather than pre-labelled strings: Jira writes the status prefix in `src/integrations/jira/adf.ts`, the preview draws a pill from `status`, and the labels live only in `src/core/evidence/schemas.ts` · the preview used to parse the prefix back out with a regex, so changing a label silently broke the pills.
- The four analysis actions load their row through `loadProject` / `loadAnalysis` (`src/features/analysis/context.ts`), which own the organization scope and the kind, status, already-published and running checks · the checks were copied per action, and one copy drifting means a cross-tenant read or a second publish.
- Organization writes (create, rename, invite, remove, cancel, accept, reject) run as server actions in `src/features/organizations/actions.ts`; components keep `authClient` only for sign-in, sign-out and `setActive`, and organization slugs are generated server-side with a UUID suffix and a retry on collision · permissions stay enforced by Better Auth, these paths get the same error mapping as other actions, and the browser no longer chooses a slug.
- `analysis.input` is typed as a stored union (create request and answers, audit issue key, legacy `title`) with `$type` on the column; `readAnalysis` tags it with the row's kind and parses input, draft and audit report once for the page · three call sites parsed the JSON differently and a legacy row could crash the view.
- `runAnalysis` is split into `startAnalysis` and `restartAnalysis`, which share the execute-and-record step; `deleteProject` is typed `Promise<never>` because it only redirects · the optional `rerunId` hid two different row lifecycles, and the old return type promised a value that a redirect never produces.

## Performance and hygiene P3 (2026-10-23)

- Publishing opens only the tracker (`buildProjectTracker`); drafting and auditing still open both providers · publishing used to call `GithubSource.connect` just to reach Jira, an extra API call per approval.
- Providers may implement `getResource(ctx, id)`; project creation asks for the submitted id and falls back to `listResources` only without it · validating a choice used to page through every repository and project on the account.
- JQL values go through `jqlString`, which escapes backslashes before quotes · retrieval terms are currently `[a-z0-9]`, but the query must not depend on that staying true.
- Organization role names live in `src/core/organizations/roles.ts` rather than `src/features` · `src/infrastructure/auth/session.ts` enforces the admin check, and infrastructure may not import features.

## Model choice (2026-10-24)

- Generator `deepseek-flash` (DeepSeek-V4.1-Flash), judge `deepseek-v4-pro` (DeepSeek-V4-Pro) · on the four fixtures Flash scored 45/48 and Pro 44/48 as generators, with Flash 3 to 4 times faster and about half the output tokens. The judge should be at least as strong as the generator. Both are one vendor; a cross-vendor judge is open work.
- The baseline judge reads the fixture repository as the source of truth and treats `verifiedFacts` as guidance, and drafts are regenerated in the same run (`tests/evaluation/draft-case.ts`) · judged on `verifiedFacts` alone, it marked a correct claim wrong, and it was scoring drafts from an older pipeline.

## Chat refinement (2026-10-24)

- The new-ticket page is a conversation beside the draft: the request, each answered question and each follow-up are chat bubbles, the latest reply carries the open questions as option chips, and one composer is always visible; there is no separate "Edit request" form, since a follow-up can change anything the request said · refining used to need either the question card or the hidden "Edit request" form, and a change outside the questions had no place to go.
- A free-text message is stored as `{ message }` in the same `answers` array as `{ question, answer }` (`refinementSchema`), so the history keeps the order the requester sent things in, and the prompt renders it as `Follow-up:` inside `<answers>` with "a later follow-up wins" · separate arrays would reorder the transcript and lose which instruction came last. One send carries the question answers and the message together (`refineTicket`); unanswered questions are sent blank so they stay open.

## Visual refinement (2026-10-24)

- Neutrals carry a faint cool tint (hue 265), the app canvas sits one step below white so cards read as layers, and one brand hue (`--brand`) marks only identity and current location: the logo, the active nav underline, the next setup step, focus, selection and caret. Buttons stay ink · the stock shadcn look was kept on purpose; color is reserved so it keeps meaning.
- Claim and connection states use semantic tokens (`--success`, `--info`, `--warning`) through `Badge` variants instead of raw Tailwind palette classes · "needs clarification" was shown as destructive, which reads as an error rather than a question.
- Verified claims show a check mark and their evidence IDs as citations (`e4`) in the preview and in the Jira text, and "Relevant context" lists each source under its ID · the product's claim is that verified means traceable, and an unmarked sentence could not be told apart from an unlabelled one. The editor disables Verified for a claim with no cited evidence, matching the approval check in `validateEvidenceReferences`, whose messages now name the item ("Acceptance criterion 2 …") instead of a JSON path.
- Open questions moved out of the chat into an "Open questions" block above the ticket preview, answered together and sent as one redraft; each can be explicitly left open, and earlier answers collapse into "Decided earlier". The chat keeps the request, history and free-text change requests. Chat and block share one draft round (`RefinementProvider`), so answers typed in the block go with a chat message instead of being lost. Claims that need a decision link to the block; questions are not tied to specific claims, since that needs a schema and prompt change and an eval run · supersedes "the latest reply carries the open questions as option chips" above. The questions were duplicated in the chat and the preview, and answering in the chat meant reading the draft in the other column.
- The approval bar states readiness from the current (edited) draft: open questions, claims that need clarification and answers not yet applied, plus what approval does ("Creates a new issue in KAN"). With anything unresolved, approving asks for an inline confirmation instead of publishing on the first click; inferred and unknown claims do not block, since they are published labelled. A redraft with manual edits asks before discarding them, and leaving the page with edits triggers the browser's unsaved-changes prompt · the redraft does not use the edited draft as its base, which would need a prompt change.
- Backtick spans in drafts render as inline code in the app and as ADF `code` marks in Jira (`inlineSpans` in `render.ts`), so the preview matches what is published · drafts are full of file paths and identifiers, which showed as raw backticks in both places.

## Organization settings and draft edits (2026-10-24)

- Members' roles can be changed from `/settings/organization`: owners manage admins and members, admins manage members, and nobody changes their own role there; the action is a server action and Better Auth still enforces permissions · role names existed as constants but there was no way to promote or demote somebody.
- The same page can leave an organization (the last owner is refused by Better Auth) or delete one (owner only, confirmed with the typed organization name); Better Auth clears the active organization, and the action activates the user's next membership or sends them to onboarding · creating and switching organizations worked, but there was no way out and a multi-organization member would have been stranded with no active organization.
- Manual draft edits autosave to `editedResult` 800 ms after the last change and are restored on reload; the write is conditional on the analysis not being published, and the existing discard confirmation still guards a redraft · edits were only client state, so a reload lost unapproved work even though leaving the page already warned.

## Quality and evaluation coverage (2026-10-24)

- A fixture now describes its whole input: `kind` (create or audit), an optional full `request` next to the short `title`, the `issue` to audit, `relatedIssues` the tracker holds, prepared `answers`, and `tags` (`src/core/evaluation/fixtures.ts`) · the eval could only replay a one-line create request with an empty tracker, so an audit, a duplicate ticket, a multi-paragraph request and a clarification round had nowhere to live. Nine fixtures now cover those, plus copy hidden behind a `tsconfig` alias and a prompt-injection file.
- `draftCase` runs audit fixtures through `auditIssue` and records the result as `output` instead of `draft`, and `draftCase`/`baseline.eval` skip cases their flow cannot represent · an audit has no baseline draft to compare and an answered case would be judged against the wrong request.
- Each eval case now ends with a judged verdict appended to `results/<case>.json`: the judge lists forbidden claims presented as requirements and uncertain points stated as fact, and either list fails the case (`tests/evaluation/judge.ts`) · free-text claims such as "a 15-minute reset token" cannot be caught by substring checks, and evidence-reference validation alone passed drafts that invented intent.
- Clarification cases assert deterministically what a rule can check (an answered question must not come back, a blank answer stays open, `appliedAnswers` appear) with a 50% shared-keyword match for re-asked questions, and leave "a later follow-up wins" to the judge · question wording varies between drafts, so exact text matching would fail a correct draft.
- The prompt-injection subset (`injection.eval.ts`, tagged `injection` and `control`) also asserts that no claim echoes the injected instruction and that every `verified` claim cites evidence, and `.github/workflows/ai-nightly.yml` runs it nightly with a cheap generator and a separate judge · `pnpm eval` is too slow and costly for CI, but nothing else exercised injected repository text.
- A fresh Jira token answered with 401 now marks its grant `needs_reconnect` and raises `ReconnectRequiredError` (`markReconnect` on `ConnectionContext`) · only a rejected refresh did, so a revoked grant kept failing every publish with a raw API error until an admin reconnected by hand.
- Coverage floor raised from 40% to 55% statements and lines, 50% branches, 52% functions, after the suite reached 57.9% / 54.2% / 55.5% / 58.9% · the new integration tests for connection callbacks, server-action errors and the Jira client made the old floor meaningless.

## Architecture enforcement (2026-10-24)

- `src/app` may not import `@/integrations`: the two OAuth routes resolve a provider through `providerById` in `features/integrations/resolve.ts` · routes were reaching into the adapter registry, so wiring an adapter bypassed the feature layer even though AGENTS.md describes `app → features → core`. Pages keep importing `infrastructure` for the session and the database, which is request plumbing, not business logic.
- `ConnectionMissingError` lives in `core/errors.ts`, next to `ForbiddenError` and `AnalysisAlreadyRunningError` · the generic `features/errors.ts` imported it from `features/integrations/resolve.ts`, so a shared error mapper depended on one specific feature.
- ESLint now also bans `node:*` in `core` and framework packages (`next`, `react`, `server-only`, `drizzle-orm`, `postgres`, `octokit`, `ai`, `better-auth`, `@ai-sdk`) in `core` and `lib` · "pure" and "dependency-free" were only conventions: nothing stopped a filesystem read or a Next import from creeping into `core`, and `lib` could have pulled a database driver into a leaf helper.
- `tests/unit/architecture.test.ts` recomputes the layer matrix from every `src` import and fails on a cross-layer edge, a package outside `core`/`lib`'s allow-list, or an infrastructure import from `components` other than `auth/client` · ESLint is the fast feedback, but the test is the invariant: editing the rules no longer silently relaxes the architecture.
- `infrastructure` is documented as allowed to import `core` types (`db/schema` uses `TicketDraft`, `EvidenceIssue` and `StoredAnalysisInput`; auth uses `ForbiddenError` and role names) · the old table said `infrastructure` + `lib` only, which contradicted code that is correctly pointing inward.
- The stale-run rule moved to `src/core/analysis/stale.ts` · `features/projects/queries.ts` imported it from `features/analysis`, the only place where the parent feature depended on a sibling use case; the rule is pure domain logic with no dependencies, so it belongs one layer in.

## Retrieval on large or unusual repositories (2026-10-24)

- `GithubSource.listFiles` checks the recursive tree's `truncated` flag and, when set, rebuilds the list through one `git.getTree` call per directory, breadth first (`walkTree` in `src/integrations/github/tree.ts`) · GitHub truncates the single recursive call around 100,000 entries or 7 MB, and the old code ignored the flag, so retrieval silently worked from a partial file list. Directories are listed one at a time to stay inside rate limits and because the path only runs on repositories large enough to matter; the added latency is filed as a measurement in `TODO-NON-CODE.md`. `git.getTree` takes no `page` / `per_page` (corrected 2026-10-24): the first version paged it, got the same listing back every time, and looped forever on any directory of 100+ entries. `listFiles` keeps `blob` entries only, so a directory or submodule named like a source file is never read.
- `resolveImports` resolves aliases through the repository's `tsconfig.json` when it is among the listed files: `compilerOptions.paths` patterns are matched, `baseUrl` (or the config's own directory) is the base, and JSONC comments and trailing commas are accepted (`src/core/context/paths.ts`) · aliases such as `@/` were assumed to mean `src/`, so a repository laid out differently resolved to the wrong file or none. The `@/` and `~/` conventions remain as fallbacks for repositories without a tsconfig or without `paths`.

## Publishing and run integrity (2026-10-24)

- Publish accepts only the editable draft (`draftBodySchema`) and rebuilds `evidence` from the stored result (`storedEvidence` in `features/analysis/read.ts`), filtering it to the sources the claims cite · the browser used to send the whole `TicketDraft`, so a forged excerpt and URL could be marked `verified` and published as traceable; `saveDraftEdits` also rebuilds it now, because `editedResult` is client data too and it is read back into the draft.
- Untrusted prompt text is neutralised in one place: every `<` becomes `&lt;` and a quote in an attribute becomes `&quot;` (`asText` / `asAttribute` in `integrations/ai/prompt.ts`) · a repository file or Jira description containing `</source></context>` ended the data block and the rest read as instructions, and an excerpt could open a forged `<source>` the model might cite; escaping only closing tags left that second hole.
- `GithubSource.connect` resolves the default branch to its commit SHA and uses it for the tree, file reads and links · links pointed at the branch, so a published `#L12-L40` citation drifted as soon as the branch moved, and files read during one run could come from different commits.
- `validateAuditFindings` requires a `verified` finding for `conflict_with_code` and `existing_implementation_or_duplicate` · the audit prompt said so, but nothing enforced it, so an inferred conflict or duplicate could be reported without proof.
- `retrieveFileEvidence` drops ranked files whose score is zero or below · a GitHub code-search hit whose text did not contain the terms, or a test file the penalty pushed negative, was sent to the model with an excerpt from the top of the file.
- Publishing claims the row (`publishing_since`, a two-minute lease) before the tracker write. It is released only when the tracker refused (a mapped error such as `TrackerRejectedError`); an unconfirmed write (timeout, dropped response) keeps it until it expires, since the issue may exist. Recording the key is retried once, and a final failure returns the key with "Published as KEY, but the app could not record it", warning that the app may offer to publish again once the lease expires · two tabs or a retry both passed the published check and created two issues, and a failed record write was reported as a tracker rejection. The lease is a timestamp rather than a boolean so a request that dies between claim and release does not block the analysis forever.
- `draftBodySchema.title` strips line breaks and caps at 255 characters, and the editor caps input at 255 (`maxLength`) · Jira rejects longer or multi-line summaries with a generic error.
- `listJiraProjects` pages through `/project/search` until `isLast` (one page when the flag is missing) · sites with more than 100 projects silently lost the rest in the picker.
- A `400` on a Jira write raises `TrackerRejectedError` with Jira's field message (`core/errors.ts`, mapped in `features/errors.ts`) · a too-long summary surfaced as "The issue tracker rejected the change".
- An audit stores the issue's `updated` timestamp in its result (`issueUpdatedAt`); Jira returns it as `fields.updated` and only when requested, so it is in `ISSUE_FIELDS`. Applying it re-reads the issue inside the publish write (so tracker errors get the publish handling) and refuses with a `TrackerRejectedError` when the timestamp moved · apply replaced the summary and description, so an edit made in Jira after the audit ran was silently lost.
- `analysis.started_at` and `analysis.run_token` separate a run's start from its creation: staleness and latency read `startedAt`, `createdAt` stays fixed, and `recordOutcome` writes only while the row still carries the run's token · a re-run used to rewrite `createdAt`, and a slow run finishing late overwrote the newer result. The client remount keys (`runKey`, `DraftWorkspace`) now use `startedAt`, which is what made the old rewrite work.
- Admin server actions (`renameOrganization`, `inviteMember`, `removeMember`, `updateMemberRole`, `cancelInvitation`, `deleteProject`) call `requireOrgAdmin` inside the `try` that `failure` handles (`deleteProject` uses `withActionErrors`), and `failure` runs `unstable_rethrow` first so a sign-in redirect still navigates · `requireOrgAdmin` threw outside the error handling, so a demoted member saw the error page instead of "Only organization owners and admins can do this".
- Each run stores the commit it read (`analysis.source_revision`, from `ContextSource.revision`), and a re-run moves the last known one to `previous_source_revision` (kept through a failed re-run); the draft page shows the short commit in its header and, before publishing, a notice when the two differ · a draft refined days later could cite code that had moved, and nothing told the user its evidence came from a different commit than the draft they had reviewed. Sources without commits (the eval `DirectorySource`) leave both empty and show nothing.

## Test and evaluation coverage (2026-10-25)

- Five audit fixtures join `stale-ticket-audit`: a ticket without acceptance criteria (`audit-vague-search`), one already shipped (`audit-existing-dark-mode`, with a Done related issue), one whose claims contradict the code (`audit-orders-page-size`), a sound ticket that should draw few findings (`audit-stock-badge`), and an `injection`-tagged audit whose description and related issue carry instructions and a `</ticket>` breakout (`audit-injected-ticket`) · audits are half the product and had one case. The fixture test now asks for at least eight cases instead of eight to ten, since C3 sets a floor, not a cap.
- `tests/unit/fixture-recall.test.ts` runs retrieval on every fixture without a model and fails on any missing expected file outside `KNOWN_MISSES` · retrieval is deterministic, and recall was only measured in `pnpm eval`, which costs tokens and does not run in CI.
- Component tests use React Testing Library with jsdom per file (`// @vitest-environment jsdom`), so the rest of the suite keeps the node environment; the end-to-end smoke test waits for a fake-provider mode · the draft workspace's approval, autosave and discard flows were only checked by hand.
