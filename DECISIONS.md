# Decisions

Format: date · decision · why. Newest group last. Open questions are at the top.

## Open

- AI model choice: compare quality and cost on paid mid-tier models with a separate judge model (`pnpm eval`).
- Hosting and background job mechanism: analyses run inside the server action (`maxDuration = 300`); revisit when pilot data shows requests near the limit.
- Narrower Jira scopes than `write:jira-work`.

## Foundations (2026-10-22)

- Next.js App Router, strict TypeScript, Tailwind, shadcn/ui, Zod, Vitest, pnpm · plan-mandated stack; pnpm is the package manager.
- Modular monolith; no worker, broker or vector database until a measured need · keep operations simple until data says otherwise.
- Evidence validation is separate from schema validation (`src/core/evidence/validate.ts`) · a schema-valid draft can still cite nothing.
- Claim statuses `verified | inferred | unknown | needs_clarification`; no confidence percentages · a number invites false precision.
- The model cites candidate evidence ids and never writes evidence itself; the pipeline attaches the real excerpts · prevents fabricated sources.
- Retrieval v1 is keyword scoring (path ×3 + content) over a `ContextSource`; no embeddings until recall measurements justify them.

## Dependency pins (2026-10-22)

- TypeScript stays on 5.x (7.x is not supported by typescript-eslint yet), ESLint on 9.x (follows eslint-config-next), `@types/node` on 24 (matches the Node 24 runtime). Revisit when the tooling catches up.

## AI provider (2026-10-22 to 2026-10-23)

- AI SDK 7 + Vercel AI Gateway (`AI_MODEL` is a `provider/model` string, default `anthropic/claude-sonnet-5.5`) · swappable models for the cost and quality comparison; no provider package.
- `AI_BASE_URL` + `AI_API_KEY` route the same code to any OpenAI-compatible endpoint (Gemini free tier, Groq, OpenRouter, Ollama, DeepSeek); the gateway stays the default when `AI_BASE_URL` is unset.
- `AI_STRUCTURED_OUTPUTS=false` falls back to JSON mode with the schema appended to the instructions · endpoints like DeepSeek reject `json_schema`; Zod still validates the output.
- The baseline eval scores original / generic AI / ContextLayer with an LLM judge against fixture ground truth · cheap and repeatable; biased when the judge is the generating model, so results are directional until a separate judge and human scoring exist.
- OpenCode Go is not used for the app · its terms limit it to coding-agent traffic and require a session header.

## Real integrations (2026-10-22)

- Postgres + Drizzle ORM (postgres-js); PGlite runs the same migrations in integration tests.
- Better Auth (email and password) with the organization plugin: an organization is the tenant boundary; every query is scoped by `organizationId`.
- GitHub App (read-only Contents and Metadata). The install callback exchanges the OAuth `code` and checks the user's installations, because `installation_id` in the URL is attacker-controlled.
- Jira Cloud via OAuth 2.0 (3LO); tokens AES-256-GCM encrypted with `ENCRYPTION_KEY`. Publishing creates a Task (else the first non-subtask type); audit "apply" overwrites summary and description.
- OAuth states are HMAC-signed, bound to user and organization, valid 10 minutes.
- Retrieval: path scoring + GitHub code search (best effort) → read top 20 → rescore → 8 candidates; related Jira issues via JQL `text ~`.
- Cache Components and partial prefetching are disabled: the app is authenticated and dynamic.
- Analyses run synchronously in the server action (no job infrastructure until workload data says otherwise).

## Engineering standards (2026-10-23)

- Extra strict TypeScript (`noUncheckedIndexedAccess`, `noImplicitReturns`, `noUnused*`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`) · indexing bugs surface at compile time; `first()` replaces non-null assertions.
- ESLint `strictTypeChecked` + `stylisticTypeChecked` with zero warnings, and `no-restricted-imports` per layer plus `import/no-cycle` · AGENTS.md says dependencies point inward; the linter now enforces it. `core` may import only `core` and `zod`.
- `consistent-type-definitions: type` · the codebase derives types from Zod and uses type aliases throughout.
- Prettier (120 columns, Tailwind class sorting), `src/components/ui` excluded · the shadcn CLI regenerates those files in its own style.
- knip fails on unused files, exports and dependencies · enforces "no dead code". Unused shadcn components (`select`, `separator`, `skeleton`, `tabs`) were deleted; add them back with the CLI when needed.
- Vite's native `resolve.tsconfigPaths` replaces `vite-tsconfig-paths`; Vitest configs are `.mts` to avoid the CJS config loader warning.
- Blank `KEY=` values in `.env.local` count as unset (`parseEnv`) · copying `.env.example` unchanged used to crash on `AI_BASE_URL=`.
- `pnpm setup` generates `BETTER_AUTH_SECRET` and `ENCRYPTION_KEY` and never overwrites an existing `.env.local`.
- Pre-commit runs lint-staged (simple-git-hooks); CI runs the same gates as `pnpm check` plus coverage with a 40% floor (current coverage is about 44%; ratchet it up as tests are added).
- `typedRoutes` enabled and baseline security headers (`nosniff`, `X-Frame-Options: DENY`, referrer and permissions policies) set in `next.config.ts`; CSP deferred.
- Dependabot weekly, minor and patch grouped.
- A new session defaults its active organization to the user's oldest membership (Better Auth `session.create.before` hook) · without it every sign-in landed on onboarding and created another organization.
- Linking a GitHub installation that already belongs to another organization is refused (`github=taken`) instead of silently doing nothing.
