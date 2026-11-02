Upgrade outdated dependencies safely.

1. Run `pnpm outdated` and read `DECISIONS.md` ("Dependency pins" and any later entries) so you don't undo a deliberate pin.
2. Group the upgrades: patch/minor of dev tooling, patch/minor of runtime packages, then each major on its own. Skip anything pinned on purpose unless the reason no longer holds; say so.
3. For every major (and for `next`, `ai`, `@ai-sdk/*`, `better-auth`, `drizzle-*`, `zod`), read the changelog or migration guide and the installed docs (`node_modules/next/dist/docs/`, `node_modules/ai/docs/`) before upgrading. Run official codemods where they exist.
4. Upgrade one group at a time with `pnpm up`; after each, run `pnpm check`. If a group breaks and the fix is more than mechanical, revert that group and file it in `TODO-REFACTOR.md` with what broke.
5. Run `pnpm audit --prod` and report anything left.
6. Record changed pins and any behaviour changes in `DECISIONS.md`. Don't commit.

Reply with a table: package, from → to, notes, and what was skipped and why.
