# Decisions

Format: date · decision · why.

- 2026-10-22 · Next.js App Router, strict TS, Tailwind, shadcn/ui, Zod, Vitest, pnpm · plan-mandated stack; pnpm is the package manager.
- 2026-10-22 · Modular monolith, no database/ORM/auth/AI provider/hosting/job runner yet · plan says to decide after feasibility work (Phase 0/2).
- 2026-10-22 · Evidence validation is separate from schema validation (`src/core/evidence/validate.ts`) · a schema-valid draft can still cite nothing.
- 2026-10-22 · Claim statuses: `verified | inferred | unknown | needs_clarification`; no confidence percentages · principle 4.

## Open

- AI model choice (compare quality/cost with `pnpm eval`), hosting, background job mechanism (analyses currently run inside the server action; `maxDuration = 300`).

## Dependency pins
- 2026-10-22 · TypeScript stays on 5.x (7.x not supported by typescript-eslint yet), ESLint on 9.x (follows eslint-config-next), `@types/node` on 24 (matches Node 24 runtime). Revisit when the tooling catches up.

- 2026-10-22 · AI via AI SDK 7 + Vercel AI Gateway (`AI_MODEL` provider/model string, default `anthropic/claude-sonnet-5.5`) · swappable models for the cost/quality comparison; no provider package.
- 2026-10-22 · `AI_BASE_URL` + `AI_API_KEY` route the same code to any OpenAI-compatible endpoint (Gemini free tier, Groq, OpenRouter, Ollama); gateway stays the default when `AI_BASE_URL` is unset.
- 2026-10-23 · `AI_STRUCTURED_OUTPUTS=false` falls back to JSON mode with the schema in the system prompt · endpoints like DeepSeek reject `json_schema`; Zod still validates the output.
- 2026-10-23 · Baseline eval scores original / generic AI / ContextLayer with an LLM judge against fixture ground truth · cheap and repeatable; biased when the judge is the generating model, so treat scores as directional.
- 2026-10-22 · The model cites candidate evidence ids and never writes evidence itself; the pipeline attaches the real excerpts · prevents fabricated sources.
- 2026-10-22 · Retrieval v1 is keyword scoring (path ×3 + content) over a `ContextSource`; no embeddings until recall measurements justify them.

## Real integrations (2026-10-22)
- Postgres + Drizzle ORM (postgres-js); PGlite runs the same migrations in integration tests.
- Better Auth (email/password) with the organization plugin: an organization is the tenant boundary; every query is scoped by `organizationId`.
- GitHub App (read-only Contents/Metadata). The install callback exchanges the OAuth `code` and checks the user's installations, because `installation_id` in the URL is attacker-controlled.
- Jira Cloud via OAuth 2.0 (3LO); tokens AES-256-GCM encrypted with `ENCRYPTION_KEY`. Publishing creates a Task (else first non-subtask type); audit "apply" overwrites summary and description.
- OAuth states are HMAC-signed, bound to user + organization, valid 10 minutes.
- Retrieval: path scoring + GitHub code search (best effort) → read top 20 → rescore → 8 candidates; related Jira issues via JQL `text ~`.
- Cache Components / partial prefetching disabled: the app is authenticated and dynamic.
- Analyses run synchronously in the server action (no job infrastructure until workload data says otherwise).
