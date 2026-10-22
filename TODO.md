# TODO

## P0 — Start immediately
- [x] Initialize repository and Next.js application
- [x] Lint, typecheck, test, build checks (`pnpm check`)
- [x] `AGENTS.md`, `README.md`, `TODO.md`, `DECISIONS.md`
- [x] Ticket / evidence / assumption / question schemas (`src/core`)
- [ ] Document product scope and open assumptions (`docs/product/plan.md` holds the plan; add assumptions)
- [x] Evaluation rubric; 4 fixture cases in `tests/fixtures` (grow to 8–10 incl. a Jira-issue and a duplicate-ticket case)
- [ ] Competitor research and customer discovery (`docs/product/*`)

## P1 — Prove the product
- [x] Title-first analysis pipeline (`src/core/analysis`) with fake-generator tests; real-model run pending an `AI_GATEWAY_API_KEY` (`pnpm eval`)
- [x] Keyword retrieval v1 (9/10 expected fixture files; misses `mail/send.ts` for "Add password reset"). Next: LLM query expansion, line-window excerpts
- [x] Structured draft generation (AI SDK `Output.object`, evidence ids resolved against retrieved candidates)
- [ ] Baseline comparison (original ticket vs generic AI); measure quality, latency, cost
- [ ] Document GitHub / Jira permission requirements and feasibility

## P2 — Connect and deliver
- [x] GitHub App, Jira Cloud connection, project↔repo mapping (needs real credentials to exercise; see `docs/engineering/integrations-setup.md`)
- [x] Review/edit UI, approval, Jira publishing
- [x] Existing-ticket audit
- [~] Authorization tests (tenant isolation done); integration-failure tests, disconnect flows, member invites, Jira refresh race

## P3 — Harden and validate
- [ ] AI regression coverage, threat model, history + metrics, private beta
