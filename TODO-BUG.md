# TODO · Bugs

Existing behaviour that is wrong: it fails, or silently returns incomplete or incorrect results. Index and conventions: [`TODO.md`](TODO.md). Items from the 2026-10-26 review cite its finding id (for example `B1`) in [`docs/engineering/project-audit-2026-10-26.md`](docs/engineering/project-audit-2026-10-26.md).

## P1 · Quality: make the core promise hold

- [ ] **A re-run overwrites the analysis author** `P1` `B15`
  - **Context:** `restartAnalysis` sets `createdByUserId` to the user who re-ran it (`src/features/analysis/run.ts:114`). With several members per organization, the history shows the wrong author.
  - **Fix:** stop updating `createdByUserId`; add a `lastRunByUserId` column only if the history needs it.

## P3 · Later: optional features and deeper hardening

- [ ] **Alias resolution ignores `extends` in `tsconfig.json`** `P3` `B6`
  - **Context:** `parseAliasConfig` reads only the file's own `compilerOptions` (`src/core/context/paths.ts:61-76`), so aliases defined in a base config are not resolved and imported files are missed in monorepos.
  - **Fix:** follow relative `extends` through `source.readFile` (stop at package extends), and replace `parseJsonc` with `jsonc-parser`. Add a case to `tests/unit/retrieve.test.ts`.

- [ ] **The dark theme is unreachable** `P3` `B16`
  - **Context:** nothing sets the `.dark` class, so the dark variables in `src/app/globals.css` and every `dark:` class in `src/components/ui` never apply.
  - **Fix:** add a theme toggle (`next-themes`, with `prefers-color-scheme` as the default). The dark styles already exist, and a public portfolio should show them working. Delete them only if you decide not to offer a dark theme.
