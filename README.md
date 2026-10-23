# ContextLayer

Turns a plain-language request (a line or a few paragraphs) into an actionable, evidence-backed Jira ticket by investigating code, docs, decisions and existing issues, and audits existing tickets for ambiguity and unsupported assumptions. Every claim is labelled **verified**, **inferred**, **unknown** or **needs clarification**; `verified` requires cited evidence, and nothing is written to Jira without explicit approval.

**Status:** private prototype. The end-to-end flow works: sign up → create or join an organization → connect GitHub and Jira → create a project → describe a request → answer the draft's questions → preview → publish. Code hosts and trackers sit behind a provider registry, so others can be added. Product validation is still open: see [`docs/product/phase-0-decision.md`](docs/product/phase-0-decision.md) and [`TODO.md`](TODO.md).

Stack: Next.js (App Router), strict TypeScript, Tailwind, shadcn/ui, Zod, Drizzle + Postgres, Better Auth, Vercel AI SDK, Vitest.

## Quick start

Requirements: Node 24, pnpm 12, Docker.

```bash
pnpm install
pnpm setup        # creates .env.local with generated BETTER_AUTH_SECRET and ENCRYPTION_KEY
pnpm db:up        # Postgres on :5434, waits until healthy
pnpm db:migrate
pnpm dev          # http://localhost:3000
```

Sign-up works right away. Analyses need an AI provider and the GitHub and Jira connections: fill in the matching blocks of `.env.local` using [`docs/engineering/integrations-setup.md`](docs/engineering/integrations-setup.md). Day-to-day workflow: [`docs/engineering/development.md`](docs/engineering/development.md).

## Scripts

| Script                                          | What it does                                                               |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| `pnpm dev` / `build` / `start`                  | Next.js dev server, production build, production server                    |
| `pnpm check`                                    | Everything CI runs: format, lint, typecheck, knip, tests, build            |
| `pnpm lint` / `lint:fix`                        | ESLint (type-aware, layer boundaries), zero warnings allowed               |
| `pnpm format` / `format:check`                  | Prettier                                                                   |
| `pnpm typecheck`                                | `next typegen` + `tsc --noEmit`                                            |
| `pnpm knip`                                     | Unused files, exports and dependencies                                     |
| `pnpm test` / `test:watch` / `test:coverage`    | Vitest (unit + PGlite integration)                                         |
| `pnpm eval`                                     | Real-model evaluation on the fixtures (needs an AI provider, costs tokens) |
| `pnpm review:export` / `review:report`          | Blind scoring packets from the last eval run; report from filled scores    |
| `pnpm db:up` / `db:down`                        | Start / stop local Postgres                                                |
| `pnpm db:generate` / `db:migrate` / `db:studio` | Drizzle migrations and studio                                              |

## Layout

```
src/app              routes and API route handlers (thin)
src/components       UI (shadcn/ui in components/ui)
src/features         use cases: projects, organizations, integrations, ticket-creation, ticket-audit, analysis
src/core             pure logic: analysis, audit, context, evidence, requirements
src/integrations     provider registry; github, jira, ai, filesystem (implement interfaces defined in core)
src/infrastructure   env, db (Drizzle), auth (Better Auth), crypto, signed state
src/lib              small dependency-free helpers
tests/               unit, integration (PGlite), evaluation, fixtures
docs/                product, engineering, architecture
```

Dependencies point inward (`app` → `features` → `core`) and ESLint enforces it. Details: [`docs/architecture/overview.md`](docs/architecture/overview.md).

## Documentation

[`docs/README.md`](docs/README.md) indexes everything. Start with [`docs/product/plan.md`](docs/product/plan.md) for the why, [`docs/architecture/overview.md`](docs/architecture/overview.md) for the how, [`DECISIONS.md`](DECISIONS.md) for choices and [`TODO.md`](TODO.md) for the backlog.

## Evaluation

`tests/fixtures/<case>/` holds a `case.json` (title, expected relevant files, verified facts, facts that must stay uncertain, forbidden invented claims) and a miniature `repo/`. `pnpm eval` runs the analysis pipeline and the baseline comparison against a real model and writes results to `tests/evaluation/results/` (gitignored). The judge is `AI_JUDGE_MODEL`; set it to a different model so the generator does not grade itself. Rubric and latest numbers: [`docs/product/evaluation-rubric.md`](docs/product/evaluation-rubric.md).

`pnpm review:export` turns the last baseline run into blind A/B/C packets under `tests/evaluation/review/` (gitignored) plus a `scores.json` template. A developer scores them, then `pnpm review:report` writes `docs/product/e3-blind-review.md` with the human result next to the judge's.
