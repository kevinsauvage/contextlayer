# TODO · Dependencies

Dependency upgrades and security advisories: version changes that may change behaviour, so they don't fit Refactor. Index and conventions: [`TODO.md`](TODO.md). Read the "Dependency pins" entries in [`DECISIONS.md`](DECISIONS.md) before upgrading, and run [`docs/prompts/dependency-upgrade.md`](docs/prompts/dependency-upgrade.md) to work through them. Items from the 2026-11-02 review (`pnpm outdated`, `pnpm audit --prod`, `npm view`); `pnpm outdated` hides releases younger than pnpm's minimum release age, so check `npm view` too.

## P2 · Production-grade: security, limits, deploy, reliability

- [ ] **Upgrade `next` and `eslint-config-next` to the November security release** `P2`
  - **Context:** both are pinned exactly to `16.4.3`. 16.4.4 (2026-11-02) backports Turbopack CSS reload, the CSP nonce in the PPR resume bootstrap, and replaces `jsonwebtoken` with `fast-jwt`; its notes announce a security release on 2026-11-03.
  - **Fix:** wait for the security release, then `pnpm up next@<v> eslint-config-next@<v>` keeping both exact pins equal. Commit the `minimumReleaseAgeExclude` entries pnpm writes (see the 2026-10-27 entry in `DECISIONS.md`). Read the release notes and `node_modules/next/dist/docs/` for deprecations, then `pnpm check` and `pnpm e2e`.

- [ ] **Upgrade `better-auth` 1.7.14 → 1.7.15** `P2`
  - **Context:** 1.7.15 fixes organization metadata with a `constructor` key failing with a prototype-pollution error (we use the `organization()` plugin), headers and cookies dropped from a `hooks.before` hook that returns nothing, and built-in social providers following HTTP redirects on token exchange and JWKS requests.
  - **Fix:** `pnpm up better-auth`, drop the stale `@better-auth/*@1.7.14` and `better-auth@1.7.14` entries from `minimumReleaseAgeExclude`, run `pnpm check` and `pnpm e2e` (sign-up, organization, invitations), and re-run `pnpm audit --prod`.

## P3 · Later: optional features and deeper hardening

- [ ] **Upgrade the AI SDK patches: `ai` and `@ai-sdk/openai-compatible`** `P3`
  - **Context:** `ai` 7.0.154 → 7.0.159 (7.0.161 once old enough) and `@ai-sdk/openai-compatible` 3.0.79 (exact pin) → 3.0.82 (3.0.83 once old enough), together because they share `@ai-sdk/provider-utils`. 7.0.155 drops runtime `ModelMessage` validation in `generateText` (no external `messages` here); 3.0.81 changes `reasoning` mapping (unused); 3.0.83 keeps tool-call arguments that arrive as strings (relevant to the evidence agent) and fixes `reasoning_effort: null`. No `DECISIONS.md` entry explains the exact pin.
  - **Fix:** `pnpm up ai @ai-sdk/openai-compatible@<3.0.x>`, keep the exact pin and record why in `DECISIONS.md`, run `pnpm check`. e2e uses the fake model, so exercise the provider manually against `AI_BASE_URL` (or `pnpm eval` when asked).

- [ ] **Patch and minor upgrades of dev tooling** `P3`
  - **Context:** `@electric-sql/pglite` 0.5.11 → 0.5.14, `typescript-eslint` 8.72.0 → 8.72.1 (TypeScript peer still `<6.1.0`), `knip` 6.43.0 → 6.44.1 (new plugins, stricter optional-peer checks; may report new findings).
  - **Fix:** `pnpm up @electric-sql/pglite typescript-eslint knip`, then `pnpm check`; fix new knip findings rather than ignoring them.

- [ ] **Patch and minor upgrades of runtime UI packages** `P3`
  - **Context:** `cn` 0.5.0 → 0.5.1 and `lucide-react` 1.61.0 → 1.66.0 (1.63 renamed `archive-restore`, unused here).
  - **Fix:** `pnpm up cn lucide-react`, `pnpm check`, then look over the pages in light and dark themes.

- [ ] **Upgrade `postgres` (postgres.js) 3.4.9 → 4.0.0** `P3`
  - **Context:** a major rewrite of pool, protocol and sockets: ESM only; the server decides parameter types (`infer: false`), so a `Date` against a `timestamp` column (the auth schema uses `timestamp()` without time zone) is taken as UTC; `sql.array()` removed; `sql.begin` rejects when COMMIT answers ROLLBACK; queries on a released connection reject. The fix for NUL characters injected into connection parameters ships only in 4.0.0. `drizzle-orm` 0.45.4 accepts `postgres >=3`, but its driver assigns into `client.options.parsers`/`serializers`, which v4 builds with `view(...)`. Only `pnpm db:migrate` and `pnpm e2e` exercise postgres.js (tests use PGlite).
  - **Fix:** read "Upgrading from v3" in the postgres README and run its parameter-type query on the dev database. On a branch: `pnpm up postgres`, `pnpm check`, `pnpm db:migrate`, `pnpm e2e`; confirm timestamps round-trip (session `expiresAt`, history keyset paging) and JSON/date columns come back as Drizzle expects. If Drizzle's parsers stop applying, revert and wait for Drizzle support. Record the decision in `DECISIONS.md`.

## Deferred · blocked upstream or tied to another decision

- [ ] **Upgrade TypeScript 6.0.3 → 7.x** `Deferred`
  - **Context:** blocked: `typescript-eslint` 8.72.1 accepts only `typescript >=4.8.4 <6.1.0`. (The stale "stays on 5.x" wording in `DECISIONS.md` is covered by "DECISIONS.md: dated follow-ups for two reversed decisions" in [`TODO-NON-CODE.md`](TODO-NON-CODE.md).)
  - **Fix:** when a `typescript-eslint` release accepts 7.x, `pnpm up typescript typescript-eslint`, then `pnpm typecheck`, `pnpm lint`, `pnpm knip`, `pnpm build`, and update the pin.

- [ ] **Upgrade ESLint 9 → 10** `Deferred`
  - **Context:** blocked: `eslint-config-next` 16.4.4 pulls `eslint-plugin-react` 7.37.5, `eslint-plugin-import` 2.32.0 and `eslint-plugin-jsx-a11y` 6.10.2, whose peers stop at `^9`. The `DECISIONS.md` pin ("follows eslint-config-next") holds.
  - **Fix:** once those plugins accept 10, `pnpm up eslint`, follow the ESLint 10 migration guide, run `pnpm lint` with zero warnings and check `lint-staged`.

- [ ] **Move to Node 26 and `@types/node` 26** `Deferred`
  - **Context:** `@types/node` is pinned to 24 to match the runtime (`.node-version` 24, read by CI; `engines` `>=24`). Node 26 is LTS since October 2026.
  - **Fix:** decide the runtime with the host ("Hosting and deploy" in [`TODO-NON-CODE.md`](TODO-NON-CODE.md)), then bump `.node-version`, `engines` and `@types/node` together, run `pnpm check` and `pnpm e2e`, and update the pin in `DECISIONS.md`.

- [ ] **Clear the `esbuild` moderate advisory (GHSA-67mh-4wv8-2f99)** `Deferred`
  - **Context:** dev-only path `better-auth` → `drizzle-kit` 0.31.11 (optional peer) → `@esbuild-kit/esm-loader` → `@esbuild-kit/core-utils` → `esbuild` 0.18.20, fixed in ≥0.25.0. Risk accepted in `DECISIONS.md` (2026-10-27); CI runs `pnpm audit --prod --audit-level high`. Upgrading `better-auth` doesn't fix it; `drizzle-kit` 1.0 (now `1.0.0-rc.5`) drops `@esbuild-kit`.
  - **Fix:** when `drizzle-kit` and `drizzle-orm` 1.0 are `latest`, upgrade both as a major (relational queries v2, migrator changes), check `drizzle/`, run `pnpm db:migrate`, `pnpm test`, `pnpm e2e`, then drop `--audit-level high` from `.github/workflows/ci.yml` as `DECISIONS.md` says.
