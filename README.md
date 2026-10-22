# ContextLayer

Turns a vague ticket title into an actionable, evidence-backed Jira ticket by investigating code, docs, decisions and existing issues, and audits existing tickets for ambiguity and unsupported assumptions. It separates **verified**, **inferred**, **unknown** and **needs clarification** instead of inventing requirements.

Stack: Next.js (App Router), strict TypeScript, Tailwind, shadcn/ui, Zod, Vitest. GitHub + Jira Cloud later.

## Getting started

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm check      # lint + typecheck + tests + build
```

Copy `.env.example` to `.env.local` when variables are introduced.

## Layout

```
src/app            routes
src/core           analysis, evidence, requirements (business logic)
src/integrations   github, jira, ai (not yet implemented)
src/infrastructure env validation, persistence
tests/             unit, integration, evaluation, fixtures
docs/              product, architecture, engineering
```

See `docs/product/plan.md` for the full plan and `TODO.md` for the backlog.
