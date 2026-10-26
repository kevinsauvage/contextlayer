# TODO · Bugs

Existing behaviour that is wrong: it fails, or silently returns incomplete or incorrect results. Index and conventions: [`TODO.md`](TODO.md). Items from the 2026-10-26 review cite its finding id (for example `B1`) in [`docs/engineering/project-audit-2026-10-26.md`](docs/engineering/project-audit-2026-10-26.md).

## P1 · Quality: make the core promise hold

- [ ] **Related-issue search is too broad** `P1` `B5`
  - **Context:** `searchRelated` builds `text ~ a OR text ~ b …` from every term and orders by `updated DESC` with a limit of 5 (`src/integrations/jira/client.ts:120-128`), so it returns recently updated issues that match any term, not the best matches.
  - **Fix:** query with the 5 strongest terms, ask for 20 issues, re-rank locally by how many terms each summary and description contains, and keep the top 5. Cover it in `tests/unit/jira-client.test.ts`.

- [ ] **Prompt escaping alters code excerpts** `P1` `B8`
  - **Context:** `asText` turns every `<` into `&lt;` (`src/integrations/ai/prompt.ts:7,60`), so JSX and generics reach the model altered while the prompt requires quoting exactly.
  - **Fix:** stop escaping content. Wrap each source in a boundary tag with a random per-request token (and tell the model that only that token closes a block), keep escaping for attribute values, and add a prompt test with JSX and an injected closing tag.

- [ ] **Autosave fails silently** `P1` `B13`
  - **Context:** `src/components/analysis/draft-workspace.tsx:96` ignores the action result. A new item is empty, which fails `draftBodySchema` (`text.min(1)`), so nothing is saved, with no indicator, until every field is filled.
  - **Fix:** show a "Saved" or "Not saved: <reason>" status next to the tabs, and store `editedResult` with a looser schema (empty text allowed) while keeping the strict schema for publishing.

- [ ] **A stale autosave can overwrite a redraft** `P1` `B14`
  - **Context:** Next.js dispatches Server Actions one at a time per client (`server-actions.md`, "Sequential dispatch on the client"), so an autosave queued before a redraft runs after it and writes the old edits over the new draft.
  - **Fix:** send the analysis `startedAt` with `saveDraftEdits` and reject it when it differs from the row, and clear the pending autosave timer when a redraft starts.

- [ ] **Jira text extraction drops content** `P1` `B11`
  - **Context:** `adfToText` (`src/integrations/jira/adf.ts:42-51`) loses `mention`, `status`, `emoji` and `date` nodes and joins table cells without a separator, so audits read damaged ticket text.
  - **Fix:** render those nodes from their `attrs.text`, separate table cells and rows, and extend `tests/unit/jira-adf.test.ts`.

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
