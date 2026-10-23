# ContextLayer

Turns a vague ticket title into an actionable, evidence-backed Jira ticket by investigating code, docs, decisions and existing issues, and audits existing tickets for ambiguity and unsupported assumptions. Every claim is labelled **verified**, **inferred**, **unknown** or **needs clarification**; `verified` requires cited evidence, and nothing is written to Jira without explicit approval.

**Status:** private prototype. The end-to-end flow works (sign up → connect GitHub and Jira → analyze → review → publish). Product validation is still open: see [`docs/product/phase-0-decision.md`](docs/product/phase-0-decision.md) and [`TODO.md`](TODO.md).

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
| `pnpm db:up` / `db:down`                        | Start / stop local Postgres                                                |
| `pnpm db:generate` / `db:migrate` / `db:studio` | Drizzle migrations and studio                                              |

## Layout

```
src/app              routes and API route handlers (thin)
src/components       UI (shadcn/ui in components/ui)
src/features         use cases: projects, ticket-creation, ticket-audit, analysis, integrations
src/core             pure logic: analysis, audit, context, evidence, requirements
src/integrations     github, jira, ai, filesystem (implement interfaces defined in core)
src/infrastructure   env, db (Drizzle), auth (Better Auth), crypto, signed state
src/lib              small dependency-free helpers
tests/               unit, integration (PGlite), evaluation, fixtures
docs/                product, engineering, architecture
```

Dependencies point inward (`app` → `features` → `core`) and ESLint enforces it. Details: [`docs/architecture/overview.md`](docs/architecture/overview.md).

## Documentation

[`docs/README.md`](docs/README.md) indexes everything. Start with [`docs/product/plan.md`](docs/product/plan.md) for the why, [`docs/architecture/overview.md`](docs/architecture/overview.md) for the how, [`DECISIONS.md`](DECISIONS.md) for choices and [`TODO.md`](TODO.md) for the backlog.

## Evaluation

`tests/fixtures/<case>/` holds a `case.json` (title, expected relevant files, verified facts, facts that must stay uncertain, forbidden invented claims) and a miniature `repo/`. `pnpm eval` runs the analysis pipeline and the baseline comparison against a real model and writes results to `tests/evaluation/results/` (gitignored). Rubric and latest numbers: [`docs/product/evaluation-rubric.md`](docs/product/evaluation-rubric.md).
