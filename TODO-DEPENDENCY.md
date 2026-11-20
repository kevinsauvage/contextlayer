# TODO · Dependencies

Dependency upgrades and security advisories: version changes that may change behaviour, so they don't fit Refactor. Index and conventions: [`TODO.md`](TODO.md). Read the "Dependency pins" entries in [`DECISIONS.md`](DECISIONS.md) before upgrading, and run [`docs/prompts/dependency-upgrade.md`](docs/prompts/dependency-upgrade.md) to work through them. Items from the 2026-11-02 review (`pnpm outdated`, `pnpm audit --prod`, `npm view`); `pnpm outdated` hides releases younger than pnpm's minimum release age, so check `npm view` too.

## P2 · Production-grade: security, limits, deploy, reliability

No open items.

## P3 · Later: optional features and deeper hardening

- [ ] **Apply the pending minor and patch releases** `P3`
  - **Context:** `pnpm outdated` on 2026-11-20 lists, within the pinned majors: `ai` 7.0.173 → 7.0.177, `@ai-sdk/openai-compatible` 3.0.92 → 3.0.93, `better-auth` 1.7.24 → 1.7.26, `lucide-react` 1.73.0 → 1.76.0, and dev tools (`vitest` and `@vitest/coverage-v8` 5.1.1, `@playwright/test` 1.65.1, `typescript-eslint` 8.73.0, `knip` 6.46.1, `dependency-cruiser` 18.8.0, `lint-staged` 17.6.1, `@electric-sql/pglite` 0.5.17, `@testing-library/user-event` 14.6.13). Dependabot may already have opened some of them.
  - **Fix:** merge the Dependabot PRs or run `pnpm up` within the current ranges, then `pnpm check` and `pnpm e2e`. Read the `better-auth` changelog first: it owns sessions, rate limits and organizations.

## Deferred · blocked upstream or tied to another decision

- [ ] **Upgrade TypeScript 6.0.3 → 7.x** `Deferred`
  - **Context:** blocked: `typescript-eslint` 8.72.1 accepts only `typescript >=4.8.4 <6.1.0`. (The stale "stays on 5.x" wording in `DECISIONS.md` is covered by "DECISIONS.md: dated follow-ups for two reversed decisions" in [`TODO-NON-CODE.md`](TODO-NON-CODE.md).)
  - **Fix:** when a `typescript-eslint` release accepts 7.x, `pnpm up typescript typescript-eslint`, then `pnpm typecheck`, `pnpm lint`, `pnpm knip`, `pnpm build`, and update the pin.

- [ ] **Upgrade ESLint 9 → 10** `Deferred`
  - **Context:** blocked: `eslint-config-next` 16.4.4 pulls `eslint-plugin-react` 7.37.5, `eslint-plugin-import` 2.32.0 and `eslint-plugin-jsx-a11y` 6.10.2, whose peers stop at `^9`. The `DECISIONS.md` pin ("follows eslint-config-next") holds.
  - **Fix:** once those plugins accept 10, `pnpm up eslint`, follow the ESLint 10 migration guide, run `pnpm lint` with zero warnings and check `lint-staged`.

- [ ] **Move to Node 26 and `@types/node` 26** `Deferred`
  - **Context:** `@types/node` is pinned to 24 to match the runtime (`.node-version` 24, read by CI; `engines` `>=24 <25`, which also keeps Vercel on 24.x; Dependabot ignores the `@types/node`, `eslint` and `typescript` majors until then). Node 26 is LTS since October 2026.
  - **Fix:** decide the runtime with the host ("Hosting and deploy" in [`TODO-NON-CODE.md`](TODO-NON-CODE.md)), then bump `.node-version`, `engines` and `@types/node` together, run `pnpm check` and `pnpm e2e`, and update the pin in `DECISIONS.md`.

- [ ] **Clear the `esbuild` moderate advisory (GHSA-67mh-4wv8-2f99)** `Deferred`
  - **Context:** dev-only path `better-auth` → `drizzle-kit` 0.31.11 (optional peer) → `@esbuild-kit/esm-loader` → `@esbuild-kit/core-utils` → `esbuild` 0.18.20, fixed in ≥0.25.0. Risk accepted in `DECISIONS.md` (2026-10-27); CI runs `pnpm audit --prod --audit-level high`. Upgrading `better-auth` doesn't fix it; `drizzle-kit` 1.0 (now `1.0.0-rc.5`) drops `@esbuild-kit`.
  - **Fix:** when `drizzle-kit` and `drizzle-orm` 1.0 are `latest`, upgrade both as a major (relational queries v2, migrator changes), check `drizzle/`, run `pnpm db:migrate`, `pnpm test`, `pnpm e2e`, then drop `--audit-level high` from `.github/workflows/ci.yml` as `DECISIONS.md` says.
