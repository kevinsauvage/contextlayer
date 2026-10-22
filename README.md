# ContextLayer

Turns a vague ticket title into an actionable, evidence-backed Jira ticket by investigating code, docs, decisions and existing issues, and audits existing tickets for ambiguity and unsupported assumptions. It separates **verified**, **inferred**, **unknown** and **needs clarification** instead of inventing requirements.

Stack: Next.js (App Router), strict TypeScript, Tailwind, shadcn/ui, Zod, Vitest. GitHub + Jira Cloud later.

## Getting started

```bash
pnpm install
docker compose up -d          # local Postgres on :5434
cp .env.example .env.local    # fill in secrets (see docs/engineering/integrations-setup.md)
pnpm db:migrate
pnpm dev                      # http://localhost:3000
pnpm check                    # lint + typecheck + tests + build
```

Flow: sign up → create an organization → connect GitHub (App) and Jira (OAuth) → link a repo to a Jira project → paste a title or audit an issue → review/edit → approve to write to Jira.

## Layout

```
src/app              routes, API route handlers (thin)
src/features         use cases: projects, ticket-creation, ticket-audit, analysis, integrations
src/core             pure logic: analysis, audit, context, evidence, requirements
src/integrations     github, jira, ai, filesystem (implement core interfaces)
src/infrastructure   env, db (Drizzle), auth (Better Auth), crypto, signed state
tests/               unit, integration (PGlite), evaluation, fixtures
docs/                product, engineering
```

## Evaluation fixtures

`tests/fixtures/<case>/` holds a `case.json` (title + expected relevant files, verified facts, things that must stay uncertain, forbidden invented claims) and a mini `repo/`. Rubric: `docs/product/evaluation-rubric.md`.

## Running the evaluation

```bash
cp .env.example .env.local   # set AI_GATEWAY_API_KEY
pnpm eval                    # writes tests/evaluation/results/<case>.json (draft, recall, latency, tokens)
```
