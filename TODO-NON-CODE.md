# TODO · Non-code

Research, decisions, manual reviews, configuration and documentation: work that ships no application code. Index and conventions: [`TODO.md`](TODO.md). Items from the 2026-10-26 review cite [`docs/engineering/project-audit-2026-10-26.md`](docs/engineering/project-audit-2026-10-26.md).

## P1 · Quality: make the core promise hold

- [ ] **Measure retrieval recall after query expansion** `P1` `E6`
  - **Context:** retrieval now asks the model for 5–10 code-search terms and merges them with `extractTerms`, but recall has not been measured on real repositories. The deterministic fixture test runs without a model and still records `mail/send.ts` as a known miss.
  - **Fix:** run retrieval on every fixture and on this repository (ContextLayer, about 300 files, through the local git source in [`TODO-FEATURE.md`](TODO-FEATURE.md), since it has no GitHub remote) with expansion on, using 5 to 8 requests whose relevant files you list beforehand; record recall per case in `validation-experiments.md`, and consider embeddings only if recall stays under 90%.

## P2 · Polish and evidence

- [ ] **Hosting and deploy** `P2`
  - **Context:** the app only runs locally; there is no production database, env or migration step.
  - **Fix:** pick a host (Vercel with managed Postgres from the Marketplace fits the stack), document production env vars, run `drizzle-kit migrate` as a deploy step, and register the production callback URLs with GitHub and Atlassian.

- [ ] **Dependency hygiene before the first deploy** `P2`
  - **Context:** `pnpm audit --prod` reports one high finding (`body-parser` through `shadcn` > `@modelcontextprotocol/sdk` > `express`) and one moderate (`esbuild` through `better-auth` > `drizzle-kit`). `shadcn` is a CLI used for one CSS import (`src/app/globals.css:3`) but sits in `dependencies`. Patch updates are pending for `next`, `ai`, `better-auth`, `@ai-sdk/openai-compatible` and `knip`. These become production dependencies on a public site.
  - **Fix:** move `shadcn` to `devDependencies`, apply the patch updates, re-run the audit, and add `pnpm audit --prod` to `.github/workflows/ci.yml`.

- [ ] **Production readiness check** `P2`
  - **Context:** the app has only run on one machine. Several settings are fine locally and wrong on a host: the database pool is `max: 10` per process (`src/infrastructure/db/client.ts:11`), the sign-in rate limiter keeps counters in memory (`node_modules/better-auth/dist/api/rate-limiter/index.mjs:6`), and OAuth redirect URIs come from `BETTER_AUTH_URL` (`src/features/integrations/oauth-flow.ts:13`). The existing "Hosting and deploy" item covers the host and migrations but not these.
  - **Fix:** use the host's pooled database URL with a low `max` and test a few concurrent requests; configure database storage for the rate limiter; set `BETTER_AUTH_URL` and register the production callback URLs; check that the GitHub App and the Atlassian app can be used by accounts other than yours (check each provider's settings); generate new production values for `BETTER_AUTH_SECRET` and `ENCRYPTION_KEY`; run `pnpm build` and the app with production env on a preview deployment before going public.

- [ ] **Customer data-flow page** `P2`
  - **Context:** on a public site, visitors who connect a repository or a Jira site send source code and ticket text to the AI provider, and the app stores excerpts in `analysis.result`. They should be told where it goes and for how long before they connect anything.
  - **Fix:** write a public page covering what is read, sent, stored and for how long, and link each provider's retention terms.

- [ ] **Threat model** `P2`
  - **Context:** prompt injection through repository and Jira text, tenant isolation and token handling are mitigated piecemeal (see "Security model" in `docs/architecture/overview.md`) but never reviewed as a whole.
  - **Fix:** write `docs/architecture/threat-model.md` (assets, actors, entry points, mitigations, gaps) and file every gap in the matching `TODO-*.md`.

- [ ] **Narrower Jira scopes** `P2`
  - **Context:** `src/integrations/jira/oauth.ts` requests `read:jira-work` and `write:jira-work`, which grant broad access.
  - **Fix:** switch the Atlassian app to granular scopes (read issues and projects, write issues only), update the scope list in `oauth.ts` to match, and check that search, create and update still work.

## P3 · Later: optional features and deeper hardening

- [ ] **Configure the nightly eval** `P3`
  - **Context:** `.github/workflows/ai-nightly.yml` runs the prompt-injection subset, but the repository has no remote and no AI secrets, so it has never run.
  - **Fix:** add the `AI_API_KEY` and `AI_BASE_URL` secrets (and optional `AI_JUDGE_*` ones), push, trigger the workflow manually once, and confirm the injection case and the control both pass.

- [~] **Blind human scoring** `P3` `E3`
  - **Context:** E2 is done: a repository-grounded judge scored ContextLayer 45, generic AI 12 and the original 11 of 48, with Flash generating and Pro judging. Both are DeepSeek, and E3 (three reviewers, ten blind tickets) has not run. The generic-AI version sees only the ticket title, so the 45 vs 12 vs 11 gap overstates the advantage over an AI that reads the code (see "Fair baseline in the evaluation" in [`TODO-QUALITY.md`](TODO-QUALITY.md)).
  - **Fix:** run `pnpm review:export`, score the packets in `tests/evaluation/review/` into `scores.json`, run `pnpm review:report`, and update E2/E3 in `validation-experiments.md`. Optionally add one cross-vendor judge or generator to remove same-vendor bias.

- [ ] **Portfolio presentation** `P3`
  - **Context:** a portfolio visitor decides in a minute. The repository has detailed engineering documents but no short story: what it does, a screenshot or recording, and how it was evaluated.
  - **Fix:** write a short `README.md` top section with the problem, a screenshot or GIF of a draft with its evidence, the live link (to the demo clone once it exists), and the evaluation numbers with their limits (judge and baseline, once the fair baseline exists). Link the audit and `docs/architecture/overview.md`. Do not include numbers that were not measured.

- [ ] **Run a repo-aware agent as the baseline** `P3` `C2` `E2`
  - **Context:** the generic-AI baseline in E2 sees only the ticket title, but the realistic alternative is an AI agent that reads the repository and Jira. C2 ("clearly better than generic AI") is unproven until that comparison is made.
  - **Fix:** on every fixture and on this repository (ContextLayer, about 300 files), run Claude Code in the checkout with a Jira MCP server and a plain "write the ticket" prompt, plus the same run with this project's rules as the prompt. Score the outputs blind with `docs/product/evaluation-rubric.md` next to ContextLayer's, and record the result and the cost in E2. Combine with "Competitor research: hands-on comparison" above.

- [ ] **Spike: agentic retrieval against the current retrieval** `P3` `E6`
  - **Context:** `src/core/context/` is about 540 lines of hand-written retrieval (term scoring, regex import graphs for JS, Python and Go, an alias resolver). It may be replaceable by an AI SDK tool loop with `search_code`, `read_file` and `search_issues` tools, but that would cost more tokens and time per analysis.
  - **Fix:** on a branch, build the loop with tools that mint evidence ids themselves (so citations stay checkable), run it and the current pipeline on the fixtures and on this repository (same 5 to 8 requests as the recall measurement), and record recall, tokens, latency and judge score for both in `validation-experiments.md`. Keep the current retrieval unless the loop is clearly better.

- [ ] **Measure large-repository latency** `P3` `E6`
  - **Context:** listing a truncated tree now falls back to one paginated listing per directory (`walkTree` in `src/integrations/github/tree.ts`), so files are no longer silently lost, but the added round trips are unmeasured.
  - **Fix:** connect a GitHub App to a repository of about 1,000 files and one large enough to truncate the recursive tree, time `listFiles` for both paths, and record the numbers in `docs/engineering/phase-0-feasibility.md`.

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
  - **Fix:** when this app is finished, copy it and replace the GitHub and Jira providers with a built-in sample repository and an in-memory tracker (the fake providers from "End-to-end smoke test" in [`TODO-QUALITY.md`](TODO-QUALITY.md) are the starting point), add a one-click guest entry and switch off open sign-up, set strict daily limits, and point it at its own database and AI key. Keep it out of this backlog.
