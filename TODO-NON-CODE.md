# TODO · Non-code

Research, decisions, manual reviews, configuration and documentation: work that ships no application code. Index and conventions: [`TODO.md`](TODO.md). Items from the 2026-10-26 review cite [`docs/engineering/project-audit-2026-10-26.md`](docs/engineering/project-audit-2026-10-26.md).

## P2 · Production-grade: security, limits, deploy, reliability

- [ ] **Hosting and deploy** `P2`
  - **Context:** the app only runs locally; there is no production database, env, migration step or AI spending cap, and hosting is undecided (`DECISIONS.md` line 8). Merged with the former "Production readiness check"; its code half (serverless-safe pool, database rate limiting, run limits and CSP) has shipped.
  - **Fix:** pick a host (Vercel with Marketplace Postgres fits the stack). Document production env vars and generate new `BETTER_AUTH_SECRET` and `ENCRYPTION_KEY` values. Set `BETTER_AUTH_URL` (OAuth redirect URIs come from it, `src/features/integrations/oauth-flow.ts:13`) and register `{BASE}/api/integrations/<id>/callback` with GitHub and Atlassian. Make both apps usable by accounts other than yours (check each provider's settings). Run `drizzle-kit migrate` as a deploy step. Set a hard monthly spending limit on the AI provider account. Run `pnpm build` and the app with production env on a preview deployment before going public.

- [ ] **Customer data-flow page** `P2`
  - **Context:** on a public site, visitors who connect a repository or a Jira site send source code and ticket text to the AI provider, and the app stores excerpts in `analysis.result`. They should be told where it goes and for how long before they connect anything.
  - **Fix:** write a public page covering what is read, sent, stored and for how long, and link each provider's retention terms.

- [ ] **Threat model** `P2`
  - **Context:** prompt injection through repository and Jira text, tenant isolation and token handling are mitigated piecemeal (see "Security model" in `docs/architecture/overview.md`) but never reviewed as a whole.
  - **Fix:** write `docs/architecture/threat-model.md` (assets, actors, entry points, mitigations, gaps) and file every gap in the matching `TODO-*.md`.

- [ ] **Narrower Jira scopes** `P2`
  - **Context:** `src/integrations/jira/oauth.ts` requests `read:jira-work` and `write:jira-work`, which grant broad access.
  - **Fix:** switch the Atlassian app to granular scopes (read issues and projects, write issues only), update the scope list in `oauth.ts` to match, and check that search, create and update still work.

- [ ] **Architecture overview: describe the evidence-agent pipeline, not the deleted keyword retrieval** `P2`
  - **Context:** `docs/architecture/overview.md` lines 34–35 and 39 still describe "extractTerms + model expansion" (5–10 terms "capped at 8"), deleted per `DECISIONS.md:242,250`; `gatherContext` (`src/core/context/gather.ts:41-46`) runs the agent and `extractTerms` side by side, terms only find related Jira issues and anchor excerpts. Line 40 says "core cuts 60-line excerpts", but files arrive whole when they fit, otherwise head and tail from a 60k budget (`min(8000, 60000/files)` per file, up to 24k for one; `src/core/context/retrieve.ts:9-11,24-57`), and omits the 3-search cap (`src/integrations/ai/evidence-agent.ts:16`). The layer table (16, 18) misses `stopword` in `core` (`.dependency-cruiser.cjs:28`) and lists "filesystem adapters" instead of `git/` and `fake/` (`src/integrations/registry.ts:10-12`). The testing table (84–88) lacks `tests/components` and `tests/e2e`.
  - **Fix:** redraw the diagram as `input ─▶ evidence agent (≤ 8 files) ─▶ evidenceFromPaths + related Jira issues (extractTerms) ─▶ generator ─▶ attach evidence ─▶ validate references`; end the terms bullet with "The terms find related Jira issues and anchor excerpts of long files; nothing expands them with a model."; rewrite line 40 with the real excerpt budget and caps "8 steps, 3 searches, 10 reads, 6k characters per read, 90 s"; `core` row "`core`, `zod`, `stopword`"; `integrations` row "GitHub, Jira and AI SDK adapters, a git checkout source for evals and fake providers for e2e"; add rows `Components | tests/components | yes | jsdom` and `E2E | tests/e2e | no (pnpm e2e) | Playwright smoke with E2E_FAKE_PROVIDERS`.

- [ ] **README, AGENTS.md and development guide: wrong check/CI lists, ESLint credited with boundaries, deleted tests** `P2`
  - **Context:** `package.json` `check` runs format:check, typecheck, lint, knip, deps:check, test, build; CI (`.github/workflows/ci.yml`) also runs `pnpm audit --prod --audit-level high` and `test:coverage`, on pull requests and pushes to `main`. Drift:
    - `README.md:28` omits deps:check; the scripts table has no `pnpm deps:check` row; line 29 says lint covers "layer boundaries" and line 54 "ESLint enforces it", but boundaries moved to dependency-cruiser (`eslint.config.mjs:47-48`); line 33 omits the jsdom component tests; the layout (46–47, 50) omits `core/evaluation`, `core/integrations`, `core/organizations`, lists a removed `filesystem` integration (real: `ai`, `fake`, `git`, `github`, `jira`) and omits `tests/e2e`.
    - `AGENTS.md:18` lists `format:check`, `lint`, `typecheck`, `knip`, `test`, `build`: misses `deps:check` and the CI extras. Edit below the generated Next.js block.
    - `docs/engineering/development.md`: line 27 cites the deleted `tests/unit/retrieve.test.ts`; line 37's CI list misses `deps:check`, `pnpm audit` and the push trigger; line 42 credits ESLint with `import/no-cycle` and layer boundaries (only `no-restricted-globals` in `core` remains, `eslint.config.mjs:47-58`); lines 58–61 miss `recall.eval.ts` and call the injection run a "two-case subset" (three fixtures are tagged `injection`/`control`); line 63 cites the deleted `fixture-recall.test.ts` and `KNOWN_MISSES` and omits `kind: "retrieval"` and `repository` (`src/core/evaluation/fixtures.ts:14-17,31`).
  - **Fix:** state the real `check` and CI steps once in `development.md` (and the e2e job once "Run the end-to-end smoke test in CI" in `TODO-QUALITY.md` ships) and link to it from `README.md` and `AGENTS.md` ("`pnpm check` runs the CI gates: `format:check`, `typecheck`, `lint`, `knip`, `deps:check`, `test`, `build`; CI also runs `pnpm audit` and coverage"). Add the `deps:check` row; lint becomes "(type-aware)"; credit dependency-cruiser for boundaries, package allow-lists and cycles; update the README layout and test lines; use `pnpm test tests/unit/evidence.test.ts` as the example; add the recall eval step and "the cases tagged `injection` and `control`"; replace the fixture-recall sentence with "`tests/unit/fixtures.test.ts` validates the shape; recall is measured by `recall.eval.ts`".

## P3 · Later: optional features and deeper hardening

- [ ] **Configure the nightly eval** `P3`
  - **Context:** `.github/workflows/ai-nightly.yml` runs `tests/evaluation/injection.eval.ts` at 03:17 UTC, but the repository has no AI secrets. Its credential check fails on purpose, so the scheduled run has failed every night (`gh run list --workflow ai-nightly.yml`: 2026-10-31, 11-01, 11-02) and the injection eval has never run against a model. The groom proposes P2: ten minutes of config, and a red nightly teaches you to ignore CI.
  - **Fix:** add the `AI_API_KEY` and `AI_BASE_URL` secrets (plus `AI_JUDGE_*` if the judge uses another endpoint). Trigger the workflow by hand, confirm the injection case and its control both pass, and check the next scheduled run is green. If you won't fund nightly runs, disable the `schedule` trigger instead of leaving it red.

- [~] **Blind human scoring** `P3` `E3`
  - **Context:** E2's latest run (2026-10-27, four-way, Flash generating, Pro judging) scored ContextLayer 68, retrieval-only 49, generic AI 20 and the original 23 of 72. That run predates the evidence agent (80fd978, 2026-10-28), both models are DeepSeek, and E3 (three reviewers, ten blind tickets) has not run. The packets in `tests/evaluation/review/` date from 2026-10-23, and `scripts/blind-review.mjs` leaves out the retrieval-only baseline (see "Add the retrieval-only baseline to the blind-review packets" in [`TODO-QUALITY.md`](TODO-QUALITY.md)).
  - **Fix:** after that Quality item, re-run `pnpm eval tests/evaluation/baseline.eval.ts` on the current pipeline (all create fixtures), update E2's table, then run `pnpm review:export`, score the packets into `scores.json`, run `pnpm review:report` and update E2/E3 in `validation-experiments.md`. Optionally add one cross-vendor judge or generator to remove same-vendor bias.

- [ ] **Portfolio presentation** `P3`
  - **Context:** a portfolio visitor decides in a minute. The repository has detailed engineering documents but no short story: what it does, a screenshot or recording, and how it was evaluated.
  - **Fix:** write a short `README.md` top section with the problem, a screenshot or GIF of a draft with its evidence, the live link (to the demo clone once it exists), and the evaluation numbers with their limits (judge and baseline, once the fair baseline exists). Link the audit and `docs/architecture/overview.md`. Do not include numbers that were not measured.

- [ ] **Run a repo-aware agent as the baseline** `P3` `C2` `E2`
  - **Context:** E2 now has a retrieval-only baseline (ContextLayer's own candidates plus a plain prompt), which isolates claim statuses and citations. No baseline yet explores the repository itself, and that is the realistic alternative: an AI agent that reads the repository and Jira. C2 ("clearly better than generic AI") is unproven until that comparison is made.
  - **Fix:** on every create fixture and on this repository at the pinned eval commit (323 files), run Claude Code in the checkout with a Jira MCP server and a plain "write the ticket" prompt, plus the same run with this project's rules as the prompt. Score the outputs blind with `docs/product/evaluation-rubric.md` next to ContextLayer's, and record the result and the cost in E2. Combine with "Competitor research: hands-on comparison" below.

- [ ] **Measure large-repository latency** `P3` `E6`
  - **Context:** a truncated tree falls back to one listing per directory (`walkTree` in `src/integrations/github/tree.ts`), and the evidence agent calls `listFiles` once per run, so a large repository adds round trips nobody has measured. Each agent search runs up to three GitHub code searches (`MAX_SEARCH_TERMS` in `src/integrations/source-filters.ts`) and the agent allows three searches (`MAX_SEARCHES` in `src/integrations/ai/evidence-agent.ts`): up to 9 code searches per run against GitHub's 10 a minute, so two concurrent analyses should already hit the limit. Fix "Truncated-tree walk lists the whole repository for a subdirectory project" in [`TODO-BUG.md`](TODO-BUG.md) first.
  - **Fix:** connect a GitHub App to a repository of about 1,000 files and one large enough to truncate the recursive tree. Time `listFiles` for both paths and the whole agent step. Run two analyses at once and count code searches and `failedTerms`. Record the numbers in `docs/engineering/phase-0-feasibility.md` (its line 42 still says 8 to 20 s) and file any limit change in `TODO-FEATURE.md`.

- [ ] **PRODUCT.md: analysis duration predates the evidence agent** `P3`
  - **Context:** `PRODUCT.md:36` says analyses "take roughly 8 to 20 seconds", a pre-agent figure (`docs/product/validation-experiments.md:26`). The evidence agent alone takes 9–15 s (`:103`), drafting adds 5–18 s (`:61`), a redraft was observed at 50–60 s (`DECISIONS.md`, "Project routes and review fixes"), and runs are capped at `RUN_BUDGET_MS` 270 s.
  - **Fix:** "Analyses run synchronously and take roughly 15 seconds to a minute (evidence agent plus draft); the UI must make waiting and running state clear." Re-measure before quoting a tighter range.

- [ ] **Fixtures README: pinned checkouts and duplicated recall line** `P3`
  - **Context:** `tests/fixtures/README.md:3` says every case holds "a `case.json` and a mini `repo/`", but the six `repo-*` retrieval cases read this repository at a pinned commit through `repository` (`src/core/evaluation/fixtures.ts:14-17`). Lines 22 and 28 repeat the same `recall.eval.ts` instruction.
  - **Fix:** line 3 becomes "holds a `case.json` and either a mini `repo/` or a pinned checkout (`repository`, see Large checkouts)"; delete line 22.

- [ ] **DECISIONS.md: dated follow-ups for two reversed decisions** `P3`
  - **Context:** `DECISIONS.md:22` (2026-10-22) says "TypeScript stays on 5.x", but `package.json` has `typescript ^6.0.3` since b58ea55 (2026-10-26). `DECISIONS.md:46` says "`core` may import only `core` and `zod`", but `stopword` was added in d555c40 and `.dependency-cruiser.cjs:28` allows `zod|stopword`. Neither reversal is recorded.
  - **Fix:** append a `## Dependency and boundary follow-ups (2026-11-02)` group without editing history: "TypeScript moves to 6.x (b58ea55), superseding the 5.x pin of 2026-10-22 · typescript-eslint 8 supports `<6.1`" and "`core` may also import `stopword`, superseding '`core` and `zod` only' · a pure word list with no I/O for `extractTerms`; dependency-cruiser allows exactly `zod` and `stopword`".

- [ ] **`.env.example` and env validation disagree; prompts not indexed** `P3`
  - **Context:** `.env.example:2` says the file is "Validated in src/infrastructure/env.ts", but `AI_GATEWAY_API_KEY` isn't validated there; `E2E_FAKE_PROVIDERS` is validated (`src/infrastructure/env.ts:33`) but absent from `.env.example` (set by `playwright.config.ts:24`). `docs/README.md` doesn't index `docs/prompts/`.
  - **Fix:** either validate `AI_GATEWAY_API_KEY` as optional in `env.ts` or reword the `.env.example` comment; add a commented `E2E_FAKE_PROVIDERS` line noting Playwright sets it; link `docs/prompts/README.md` from `docs/README.md`.

## Deferred · business validation, not needed for the portfolio

- [~] **Customer discovery: run 8–12 interviews** `Deferred` `E4`
  - **Context:** the guide is ready (`docs/product/customer-discovery.md`) but no interview has happened, so C1 (a real, costly problem) and C6 have no evidence.
  - **Fix:** recruit engineering managers and product owners at agencies and product teams, run the guide, fill the synthesis template after each batch of four, and update H1, H5 and H9 in `business-hypotheses.md`.

- [~] **Competitor research: hands-on comparison** `Deferred` `C6`
  - **Context:** only a desk pass exists (`docs/product/competitor-research.md`); C6 needs proof that a differentiator survives against platform features.
  - **Fix:** run Rovo, Rovo Dev, Linear Agent and Scrummy on the four fixture repositories, score them with `docs/product/evaluation-rubric.md`, record pricing, and note whether any labels unverified claims.

- [ ] **Log the go / pivot / stop decision** `Deferred`
  - **Context:** `phase-0-decision.md` fixes the criteria in advance, and its decision log is empty.
  - **Fix:** after E3 and E4, update the criteria table, apply the rule written there, and add a dated row to the log.

- [ ] **Concierge pilot** `Deferred` `E5`
  - **Context:** there is no data on whether teams publish drafts unchanged; blocked on the analysis history and usage metrics in [`TODO-FEATURE.md`](TODO-FEATURE.md).
  - **Fix:** run a two- to four-week pilot with one team and report the results in `validation-experiments.md`.

- [ ] **Demo clone (separate repository, after this app is done)** `Deferred`
  - **Context:** the public portfolio demo will be a copy of this app, not a mode inside it, so this repository stays the real product. Things the copy will have to change: it has to work without a visitor's own GitHub or Jira, it spends your AI budget, and it must not publish to a real tracker.
  - **Fix:** when this app is finished, copy it and replace the GitHub and Jira providers with a built-in sample repository and an in-memory tracker (the test-only providers and canned generator in `src/integrations/fake/` are the starting point), add a one-click guest entry and switch off open sign-up, set strict daily limits, and point it at its own database and AI key. Keep it out of this backlog.
