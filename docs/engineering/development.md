# Development guide

## Prerequisites

- Node 24 (`.node-version`; `engines` in `package.json` enforces `>=24`)
- pnpm 12 (`packageManager`; use Corepack or `npm i -g pnpm`)
- Docker (local Postgres)

## First run

```bash
pnpm install        # also installs the pre-commit hook
pnpm setup          # .env.local from .env.example with generated secrets; never overwrites an existing file
pnpm db:up          # Postgres 17 on localhost:5434, waits for the healthcheck
pnpm db:migrate
pnpm dev
```

Configuration is validated in `src/infrastructure/env.ts`. Blank values in `.env.local` count as unset, so the app starts without GitHub, Jira or AI credentials: an unconfigured provider shows as "Not configured" on the Integrations page, and analyses fail with a clear `Missing environment variables` message until an AI provider is set. To enable them: [`integrations-setup.md`](integrations-setup.md).

## Daily workflow

| Task                       | Command                                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run everything CI runs     | `pnpm check`                                                                                                                                                                                            |
| Fix formatting and lint    | `pnpm format` then `pnpm lint:fix`                                                                                                                                                                      |
| One test file              | `pnpm test tests/unit/evidence.test.ts`                                                                                                                                                                 |
| Component tests            | `pnpm test tests/components` (`.tsx`, jsdom via a `// @vitest-environment jsdom` comment)                                                                                                               |
| Watch mode                 | `pnpm test:watch`                                                                                                                                                                                       |
| Coverage (floor: 55%)      | `pnpm test:coverage`, report in `coverage/`                                                                                                                                                             |
| End-to-end smoke test      | `pnpm db:up`, then `pnpm e2e`: a production build on port 3100 with `E2E_FAKE_PROVIDERS=true` and its own `contextlayer_e2e` database (recreated each run); no GitHub, Jira or model credentials needed |
| Find dead code             | `pnpm knip`                                                                                                                                                                                             |
| Change the database schema | edit `src/infrastructure/db/schema/*`, `pnpm db:generate`, review the SQL in `drizzle/`, `pnpm db:migrate`                                                                                              |
| Browse the database        | `pnpm db:studio`                                                                                                                                                                                        |
| Reset the database         | `docker compose down -v`, `pnpm db:up`, `pnpm db:migrate` (deletes all local data)                                                                                                                      |

A pre-commit hook (simple-git-hooks + lint-staged) formats and lints staged files. `pnpm check` runs the CI gates in order: `format:check`, `typecheck`, `lint`, `knip`, `deps:check`, `test`, `build`. CI (`.github/workflows/ci.yml`) runs `pnpm audit --prod --audit-level high`, then the same gates with `test:coverage` in place of `test`, on every pull request and every push to `main`. The end-to-end smoke test is not in CI yet.

## Quality gates

- **TypeScript** is strict, plus `noUncheckedIndexedAccess`, `noImplicitReturns`, `noUnusedLocals`/`Parameters`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`. Indexing returns `T | undefined`: use `first()` from `src/lib/first.ts`, destructuring defaults or `??` instead of `!`.
- **ESLint** extends the Next.js presets and `typescript-eslint` `strictTypeChecked` + `stylisticTypeChecked`, with `--max-warnings=0`. Beyond that: type-only imports, exhaustive switches, no `console.log`, and `no-restricted-globals` in `core`.
- **dependency-cruiser** (`pnpm deps:check`) enforces the layer boundaries described in [`../architecture/overview.md`](../architecture/overview.md), the `core` and `lib` package allow-lists, and import cycles. Fix the import; never disable the rule.
- **Prettier** (120 columns, Tailwind class sorting). `src/components/ui` is excluded because the shadcn CLI regenerates it.
- **knip** fails on unused files, exports and dependencies. Delete the code, or remove the `export`, instead of suppressing the finding.

## Conventions

- Comments only when the _why_ is non-obvious.
- Derive types from Zod schemas (`z.infer`); validate every external input (forms, API responses, AI output) with Zod.
- New business logic goes in `src/core` with a unit test and a fake for any I/O; adapters go in `src/integrations`.
- Record non-obvious choices in [`DECISIONS.md`](../../DECISIONS.md) and tick finished work in the matching `TODO-<KIND>.md` (index: [`TODO.md`](../../TODO.md)).
- Adding a shadcn component: `pnpm dlx shadcn@latest add <name>`; run `pnpm format` only on files you wrote.

## Evaluating AI changes

`pnpm eval` runs `tests/evaluation/*.eval.ts` against a real model. It needs one provider configured (see the AI section of [`integrations-setup.md`](integrations-setup.md)) and costs tokens, so it is not part of `pnpm check`.

1. `pnpm eval tests/evaluation/analysis.eval.ts` writes `results/<case>.json` (the draft or audit report as `output`, retrieval recall, latency, tokens) and appends a verdict: the judge lists any forbidden claim the draft presents or any uncertain point it settles, and the case fails when either list is non-empty. Audit cases run their own issue through `auditIssue`.
2. `pnpm eval tests/evaluation/clarification.eval.ts` replays prepared answers and follow-ups: an answered question must not come back, a blank answer must stay open, `expected.appliedAnswers` must appear in the draft, and the verdict catches a draft that follows an earlier answer over a later correction.
3. `pnpm eval tests/evaluation/baseline.eval.ts` compares the original ticket, a generic AI answer and the ContextLayer draft with an LLM judge, writes `results/<case>.baseline.json`.
4. `pnpm eval tests/evaluation/recall.eval.ts` measures, without a judge, which `relevantFiles` the evidence agent reaches and writes `results/<case>.recall.json`.
5. `pnpm eval tests/evaluation/injection.eval.ts` runs the cases tagged `injection` and `control`; `.github/workflows/ai-nightly.yml` runs it nightly with a cheap model.

Results are gitignored. Record conclusions in [`../product/evaluation-rubric.md`](../product/evaluation-rubric.md). To add a case, create `tests/fixtures/<id>/case.json` and a miniature `repo/`; `tests/unit/fixtures.test.ts` validates the shape; recall is measured by `recall.eval.ts`. A case may set `kind: "audit"` with `issue`, `kind: "retrieval"` with a pinned `repository` checkout instead of `repo/`, a full `request` longer than its `title`, `relatedIssues` for retrieval, `answers` for a clarification round, and `tags`.

## Deployment

Production runs on Vercel (project `contextlayer`, connected to `main`) with Neon Postgres, at <https://contextlayer-pearl.vercel.app>. A push to `main` deploys: `vercel.json` runs `drizzle-kit migrate` before `pnpm build` on production builds, using the direct `DATABASE_URL_UNPOOLED` connection, while the app uses the pooled `DATABASE_URL` with `DB_PREPARE=false` and `DB_POOL_SIZE=5`. Preview deployments have no database. Production has its own `BETTER_AUTH_SECRET` and `ENCRYPTION_KEY`. What is still open before production is usable end to end (provider callbacks, spending limit) is tracked as "Hosting and deploy" in [`TODO-NON-CODE.md`](../../TODO-NON-CODE.md); the reasons are in the "Hosting" entry of [`DECISIONS.md`](../../DECISIONS.md).

## Troubleshooting

| Symptom                                                  | Cause and fix                                                                                                               |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `ZodError` listing env variables on start                | A required value is blank or malformed. Run `pnpm setup` for a new file, or fill `BETTER_AUTH_SECRET` and `ENCRYPTION_KEY`. |
| `connect ECONNREFUSED 127.0.0.1:5434`                    | Postgres is down: `pnpm db:up`.                                                                                             |
| `response_format type is unavailable` during `pnpm eval` | The endpoint rejects `json_schema`: set `AI_STRUCTURED_OUTPUTS=false`.                                                      |
| `Too Many Requests` during `pnpm eval`                   | Free-tier rate limit. Run one case (`-t <case-id>`) or use another provider.                                                |
| Types out of date after adding a route                   | `pnpm typecheck` regenerates route types (`next typegen`).                                                                  |
| Dev server serves old server code (hydration mismatch)   | `pnpm build` or `pnpm check` ran while `pnpm dev` was running. Restart `pnpm dev`.                                          |
| OAuth callback returns "redirect_uri mismatch"           | Callbacks are `{BASE}/api/integrations/<provider>/callback`; update the GitHub App or Atlassian app settings.               |
