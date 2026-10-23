# TODO

Only open work is listed; finished work lives in `git log` and `DECISIONS.md`. Markers: `[ ]` open, `[~]` partly done (the remaining scope is described).

## P0: Decide whether to build (Phase 0)

- [~] Customer discovery: guide ready, 0 interviews. Run 8 to 12 (`docs/product/customer-discovery.md`, E4)
- [~] Competitor research: first desk pass done. Try Rovo, Rovo Dev, Linear Agent and Scrummy on the fixture repositories and score them with the rubric; add pricing; check whether any product labels unverified claims
- [ ] Review `docs/product/phase-0-decision.md` after the interviews and the blind comparison, and log the go / pivot / stop decision
- [ ] Reconcile `docs/product/plan.md` with the original v0.2 planning document, if it still exists

## P1: Prove the product

- [~] Baseline comparison: automated and directional only. Use a judge model different from the generator, then have a developer score the 12 drafts blind (E2, E3)
- [ ] Grow fixtures from 4 to 8–10, including a Jira-issue case and a duplicate-ticket case
- [ ] Check `forbiddenClaims` and `mustStayUncertain` automatically in `analysis.eval.ts` (today only evidence references are asserted)
- [ ] Run `pnpm eval` on a paid mid-tier model and compare with DeepSeek and Gemini; record the winner in `DECISIONS.md`
- [ ] Compute cost per analysis from tokens and a per-model price; store it on the `analysis` row (needed for H7)
- [ ] Retrieval: LLM query expansion to fix the miss on "Add password reset" (`mail/send.ts`), then measure recall on real repositories (E6); embeddings only if recall stays under 90%
- [ ] Large repositories: handle a truncated GitHub tree, add monorepo subdirectory scoping, measure latency on a repository of about 1,000 files

## P2: Connect and deliver

- [ ] Exercise the full flow with real credentials: create the Atlassian dev OAuth app and a Jira dev site, connect GitHub and Jira, create a project, analyze, publish, audit (the dev GitHub App already exists)
- [~] Authorization and failure tests: tenant isolation is covered. Add integration-failure tests (GitHub and Jira errors, expired tokens, revoked installation), the Jira refresh-token race, and removed-project and removed-connection paths
- [ ] Disconnect flows for GitHub and Jira, and member invites (the `invitation` table exists, no UI)
- [ ] Mark analyses stuck in `running` as failed (a killed or timed-out request never reaches the `catch` in `runAnalysis`)
- [ ] First CI run on GitHub: confirm the workflow passes (pnpm setup, build env) and enable it as a required check
- [ ] Choose hosting and document the deploy: production env vars, running migrations on deploy, managed Postgres

## P3: Harden and validate

- [ ] Threat model: prompt injection through repository and Jira content, tenant isolation, token handling
- [ ] AI regression coverage: injection fixtures (a file that says "ignore your instructions") and a CI-friendly eval subset
- [ ] Per-organization usage limits and rate limiting on analyses (every analysis spends model tokens)
- [ ] Email verification and password reset (needs an email provider; neither exists today)
- [ ] Error monitoring and structured logging (nothing exists beyond framework defaults)
- [ ] Content Security Policy
- [ ] Narrower Jira scopes than `write:jira-work`
- [ ] Customer-facing data-flow description, provider retention terms, optional bring-your-own-key
- [ ] Raise the coverage floor from 40% (about 44% today): feature actions and integration error paths
- [ ] Analysis history, usage metrics, then a private beta with a concierge pilot (E5)
