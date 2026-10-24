# TODO · Non-code

Research, decisions, manual reviews, configuration and documentation: work that ships no application code. Index and conventions: [`TODO.md`](TODO.md).

## P0 · Decide whether to build

- [~] **Customer discovery: run 8–12 interviews** `P0` `E4`
  - **Context:** the guide is ready (`docs/product/customer-discovery.md`) but no interview has happened, so C1 (a real, costly problem) and C6 have no evidence.
  - **Fix:** recruit engineering managers and product owners at agencies and product teams, run the guide, fill the synthesis template after each batch of four, and update H1, H5 and H9 in `business-hypotheses.md`.

- [~] **Competitor research: hands-on comparison** `P0` `C6`
  - **Context:** only a desk pass exists (`docs/product/competitor-research.md`); C6 needs proof that a differentiator survives against platform features.
  - **Fix:** run Rovo, Rovo Dev, Linear Agent and Scrummy on the four fixture repositories, score them with `docs/product/evaluation-rubric.md`, record pricing, and note whether any labels unverified claims.

- [ ] **Log the go / pivot / stop decision** `P0`
  - **Context:** `phase-0-decision.md` fixes the criteria in advance, and its decision log is empty.
  - **Fix:** after E3 and E4, update the criteria table, apply the rule written there, and add a dated row to the log.

## P1 · Prove the product

- [~] **Blind human scoring** `P1` `E3`
  - **Context:** E2 is done: a repository-grounded judge scored ContextLayer 45, generic AI 12 and the original 11 of 48, with Flash generating and Pro judging. Both are DeepSeek, and E3 (three reviewers, ten blind tickets) has not run.
  - **Fix:** run `pnpm review:export`, score the packets in `tests/evaluation/review/` into `scores.json`, run `pnpm review:report`, and update E2/E3 in `validation-experiments.md`. Optionally add one cross-vendor judge or generator to remove same-vendor bias.

- [ ] **Measure large-repository latency** `P1` `E6`
  - **Context:** listing a truncated tree now falls back to one paginated listing per directory (`walkTree` in `src/integrations/github/tree.ts`), so files are no longer silently lost, but the added round trips are unmeasured.
  - **Fix:** connect a GitHub App to a repository of about 1,000 files and one large enough to truncate the recursive tree, time `listFiles` for both paths, and record the numbers in `docs/engineering/phase-0-feasibility.md`.

## P2 · Connect and deliver

- [ ] **First CI run** `P2`
  - **Context:** `.github/workflows/ci.yml` mirrors `pnpm check` but the repository has no remote yet, so it has never run on GitHub.
  - **Fix:** push a branch, fix anything environment-specific (the `pnpm setup` secrets, build env), then make the workflow a required check on `main`.

- [ ] **Hosting and deploy** `P2`
  - **Context:** the app only runs locally; there is no production database, env or migration step.
  - **Fix:** pick a host (Vercel with managed Postgres from the Marketplace fits the stack), document production env vars, run `drizzle-kit migrate` as a deploy step, and register the production callback URLs with GitHub and Atlassian.

## P3 · Harden and validate

- [ ] **Threat model** `P3`
  - **Context:** prompt injection through repository and Jira text, tenant isolation and token handling are mitigated piecemeal (see "Security model" in `docs/architecture/overview.md`) but never reviewed as a whole.
  - **Fix:** write `docs/architecture/threat-model.md` (assets, actors, entry points, mitigations, gaps) and file every gap in the matching `TODO-*.md`.

- [ ] **Narrower Jira scopes** `P3`
  - **Context:** `src/integrations/jira/oauth.ts` requests `read:jira-work` and `write:jira-work`, which grant broad access.
  - **Fix:** switch the Atlassian app to granular scopes (read issues and projects, write issues only), update the scope list in `oauth.ts` to match, and check that search, create and update still work.

- [ ] **Customer data-flow page** `P3`
  - **Context:** source code and Jira text go to the AI provider; customers will ask where and for how long.
  - **Fix:** write a public page covering what is read, sent, stored and for how long, and link each provider's retention terms.

- [ ] **Concierge pilot** `P3` `E5`
  - **Context:** there is no data on whether teams publish drafts unchanged; blocked on the analysis history and usage metrics in [`TODO-FEATURE.md`](TODO-FEATURE.md).
  - **Fix:** run a two- to four-week pilot with one team and report the results in `validation-experiments.md`.
