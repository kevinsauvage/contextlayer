# TODO

## P0 — Start immediately

- [x] Initialize repository and Next.js application
- [x] Lint, format, typecheck, dead-code, test, build checks (`pnpm check`), CI, pre-commit hook, strict TS and ESLint layer boundaries
- [x] `AGENTS.md`, `README.md`, `TODO.md`, `DECISIONS.md`
- [x] Ticket / evidence / assumption / question schemas (`src/core`)
- [x] Document product scope and open assumptions (`docs/product/plan.md`, `business-hypotheses.md`, `validation-experiments.md`)
- [x] Evaluation rubric; 4 fixture cases in `tests/fixtures` (grow to 8–10 incl. a Jira-issue and a duplicate-ticket case)
- [~] Competitor research (first desk pass done; needs hands-on comparison) and customer discovery (guide written, 0 interviews)

## P1 — Prove the product

- [x] Title-first analysis pipeline (`src/core/analysis`) with fake-generator tests; real-model eval 4/4 green on Gemini 3.8 Flash (free tier via `AI_BASE_URL`/`AI_API_KEY`, `pnpm eval`)
- [x] Keyword retrieval v1 (9/10 expected fixture files; misses `mail/send.ts` for "Add password reset"). Next: LLM query expansion, line-window excerpts
- [x] Structured draft generation (AI SDK `Output.object`, evidence ids resolved against retrieved candidates)
- [x] Baseline comparison (`tests/evaluation/baseline.eval.ts`): on DeepSeek, ContextLayer 11–12/12 vs generic AI 3–8 vs original 0–2; latency and tokens comparable. Same-model LLM judge, so spot-check by a human and use a separate judge model are still pending
- [x] Document GitHub / Jira permission requirements and feasibility (`docs/engineering/phase-0-feasibility.md`)

## P2 — Connect and deliver

- [x] GitHub App, Jira Cloud connection, project↔repo mapping (needs real credentials to exercise; see `docs/engineering/integrations-setup.md`)
- [x] Dev GitHub App `contextlayer-dev` created on github.com (Contents + Metadata read-only, OAuth on install, no webhook); ID/slug/client credentials and private key in `.env.local`
- [x] Review/edit UI, approval, Jira publishing
- [x] Existing-ticket audit
- [~] Authorization tests (tenant isolation done); integration-failure tests, disconnect flows, member invites, Jira refresh race

## P3 — Harden and validate

- [ ] AI regression coverage, threat model, history + metrics, private beta
- [ ] Content Security Policy
- [ ] Raise the coverage floor (44% now, floor 40%): features actions, integrations error paths
- [ ] Narrower Jira scopes than `write:jira-work`

## Validation backlog

- [ ] Finish baseline comparison: separate judge model, human blind scoring, 8 to 10 fixtures (see `docs/product/validation-experiments.md` E2, E3)
- [ ] Forbidden-claim and must-stay-uncertain checks in `analysis.eval.ts`
- [ ] Customer discovery interviews (E4), concierge pilot (E5)
- [ ] LLM query expansion for retrieval, recall on real repositories (E6)
