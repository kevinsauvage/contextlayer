# TODO · Bugs

Existing behaviour that is wrong: it fails, or silently returns incomplete or incorrect results. Index and conventions: [`TODO.md`](TODO.md). Items from the 2026-10-26 review cite its finding id (for example `B1`) in [`docs/engineering/project-audit-2026-10-26.md`](docs/engineering/project-audit-2026-10-26.md).

## P2 · Production-grade: security, limits, deploy, reliability

- [ ] **Query expansion can displace a file the keyword path found** `P2`
  - **Context:** the 2026-10-27 recall run (E6) lost `src/infrastructure/db/schema/app.ts` on `repo-analysis-candidates` and `src/app/(app)/projects/[projectId]/page.tsx` on `repo-progress-count` once expansion ran, both of which the model-free path retrieved. The shortlist that decides what to read ranks by path matches plus code-search rank and is cut at `READ_LIMIT` (`src/core/context/retrieve.ts:54-65`), so terms the model adds promote docs and other files and push a real file out before its content is scored. Net effect over 20 cases: two files found, two lost.
  - **Fix:** keep the request's own terms as the path-match signal for the shortlist and let expanded terms act through code search and content scoring (they already do), so expansion can only add candidates. Then make `recall.eval.ts` fail on a non-empty `unexpected` instead of only writing it, and prove both cases keep their file.

## P3 · Later: optional features and deeper hardening

- [ ] **Alias resolution ignores `extends` in `tsconfig.json`** `P3` `B6`
  - **Context:** `parseAliasConfig` reads only the file's own `compilerOptions` (`src/core/context/paths.ts:61-76`), so aliases defined in a base config are not resolved and imported files are missed in monorepos.
  - **Fix:** follow relative `extends` through `source.readFile` (stop at package extends), and replace `parseJsonc` with `jsonc-parser`. Add a case to `tests/unit/retrieve.test.ts`.

- [ ] **The dark theme is unreachable** `P3` `B16`
  - **Context:** nothing sets the `.dark` class, so the dark variables in `src/app/globals.css` and every `dark:` class in `src/components/ui` never apply.
  - **Fix:** add a theme toggle (`next-themes`, with `prefers-color-scheme` as the default). The dark styles already exist, and a public portfolio should show them working. Delete them only if you decide not to offer a dark theme.
