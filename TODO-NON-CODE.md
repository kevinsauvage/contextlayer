# TODO · Non-code

Research, decisions, manual reviews, configuration and documentation: work that ships no application code. Index and conventions: [`TODO.md`](TODO.md).

## P2 · Production-grade: security, limits, deploy, reliability

- [~] **Hosting and deploy** `P2`
  - **Context:** deployed on Vercel with Neon Postgres at <https://contextlayer-kevinsauvages-projects.vercel.app> (`DECISIONS.md`, "Hosting"). Production reuses the development GitHub App (`contextlayer-dev`), Atlassian app and AI key, and their callbacks still point at localhost, so connecting GitHub or Jira fails there.
  - **Fix:** register `https://contextlayer-kevinsauvages-projects.vercel.app/api/integrations/<id>/callback` with GitHub and Atlassian (or create production apps and replace the env vars). Make both apps usable by accounts other than yours (GitHub: "Any account"; Atlassian: distribution "Sharing"). Set a hard monthly spending limit on the AI provider account. Walk the full flow once in production.

- [ ] **Customer data-flow page** `P2`
  - **Context:** on a public site, visitors who connect a repository or a Jira site send source code and ticket text to the AI provider, and the app stores excerpts in `analysis.result`. They should be told where it goes and for how long before they connect anything.
  - **Fix:** write a public page covering what is read, sent, stored and for how long, and link each provider's retention terms.

- [ ] **Threat model** `P2`
  - **Context:** prompt injection through repository and Jira text, tenant isolation and token handling are mitigated piecemeal (see "Security model" in `docs/architecture/overview.md`) but never reviewed as a whole.
  - **Fix:** write `docs/architecture/threat-model.md` (assets, actors, entry points, mitigations, gaps) and file every gap in the matching `TODO-*.md`.

- [ ] **Narrower Jira scopes** `P2`
  - **Context:** `src/integrations/jira/oauth.ts` requests `read:jira-work` and `write:jira-work`, which grant broad access.
  - **Fix:** switch the Atlassian app to granular scopes (read issues and projects, write issues only), update the scope list in `oauth.ts` to match, and check that search, create and update still work.

- [ ] **Portfolio presentation** `P2`
  - **Context:** ContextLayer is going on the portfolio as its AI project (decided 2026-11-19). A visitor cannot try it: production sits behind Vercel Authentication, a run needs the visitor's own GitHub and Jira, and each run spends AI credit. So the first version is screenshots, a short recording and the public source (as ComplyLoop is presented); the demo clone (Deferred, below) can replace them later. The P2 items "Audit: the original ticket isn't shown before it's overwritten" and the two analysis-progress items in [`TODO-FEATURE.md`](TODO-FEATURE.md) come first, because they show in the screenshots or contradict the story, then "No automated accessibility checks" in [`TODO-QUALITY.md`](TODO-QUALITY.md) and "Public repository hygiene" below.
  - **Fix:** capture screenshots and a short GIF locally against a real repository and Jira site (production callbacks still point at localhost): a request, the draft with its claim statuses and evidence, an open question, the approval step, an audit. Write a short `README.md` top section: the problem, the GIF, what makes it different (claim statuses, evidence validation, human approval, injection handling), and how it was evaluated. Report numbers only with their limits: the 45/48 run (four fixtures, DeepSeek) cannot be quoted without the E7 run (5 of 23); prefer the method, or rerun with the default model first ("Run the judged evals with the default generator" in [`TODO-QUALITY.md`](TODO-QUALITY.md)). Then add the case study to `next-portfolio` (its `TODO.md`).

- [ ] **Public repository hygiene** `P2`
  - **Context:** found in the 2026-11-20 portfolio review. The repository is public but has no `LICENSE`, so GitHub shows "No license" and the code is all rights reserved by default, which a reader cannot tell was deliberate. The GitHub homepage field points at `https://contextlayer-pearl.vercel.app` while `README.md` names `https://contextlayer-kevinsauvages-projects.vercel.app`, and the repository has no topics. The README still opens with "Status: prototype" and the business-validation backlog, which is the first thing a recruiter reads.
  - **Fix:** add a `LICENSE` (MIT, or a short "source available, all rights reserved" notice if reuse is not wanted) and say which in the README. Point the homepage at the portfolio case study or the one live URL, and make the README use the same one. Add topics (`nextjs`, `typescript`, `llm`, `ai-sdk`, `jira`, `github-app`, `drizzle`, `better-auth`, `postgres`). Pin the repository on the GitHub profile. The README rewrite itself belongs to "Portfolio presentation" above.

## P3 · Later: optional features and deeper hardening

- [ ] **Turn the nightly eval back on when AI credit is set aside for it** `P3`
  - **Context:** the `schedule` trigger of `.github/workflows/ai-nightly.yml` was removed on 2026-11-17 so no AI credit is spent; the workflow can still be run by hand. It has never run against a model in CI: the repository has no AI secrets.
  - **Fix:** add the `AI_API_KEY` and `AI_BASE_URL` secrets, restore the `schedule` block (`cron: "17 3 * * *"`), trigger it by hand once and confirm the injection case and its control pass.

- [ ] **Run a repo-aware agent as the baseline** `P3` `C2` `E2`
  - **Context:** E2 now has a retrieval-only baseline (ContextLayer's own candidates plus a plain prompt), which isolates claim statuses and citations. No baseline yet explores the repository itself, and that is the realistic alternative: an AI agent that reads the repository and Jira. C2 ("clearly better than generic AI") is unproven until that comparison is made.
  - **Fix:** on every create fixture and on this repository at the pinned eval commit (323 files), run Claude Code in the checkout with a Jira MCP server and a plain "write the ticket" prompt, plus the same run with this project's rules as the prompt. Score the outputs blind with `docs/product/evaluation-rubric.md` next to ContextLayer's, and record the result and the cost in E2. Combine with "Competitor research: hands-on comparison" below.

- [ ] **Measure large-repository latency** `P3` `E6`
  - **Context:** a truncated tree falls back to one listing per directory (`walkTree` in `src/integrations/github/tree.ts`), and the evidence agent calls `listFiles` once per run, so a large repository adds round trips nobody has measured. Each agent search runs up to three GitHub code searches (`MAX_SEARCH_TERMS` in `src/integrations/source-filters.ts`) and the agent allows three searches (`MAX_SEARCHES` in `src/integrations/ai/evidence-agent.ts`): up to 9 code searches per run against GitHub's 10 a minute, so two concurrent analyses should already hit the limit. A truncated walk now starts inside a project's folder (`startTreeSha` in `src/integrations/github/source.ts`), so measure both a whole-repository and a subdirectory project.
  - **Fix:** connect a GitHub App to a repository of about 1,000 files and one large enough to truncate the recursive tree. Time `listFiles` for both paths and the whole agent step. Run two analyses at once and count code searches and `failedTerms`. Record the numbers in `docs/engineering/phase-0-feasibility.md` (its line 42 still says 8 to 20 s) and file any limit change in `TODO-FEATURE.md`.

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
