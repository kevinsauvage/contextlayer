# TODO · Bugs

Existing behaviour that is wrong: it fails, or silently returns incomplete or incorrect results. Index and conventions: [`TODO.md`](TODO.md). Items from the 2026-10-26 review cite its finding id (for example `B1`) in [`docs/engineering/project-audit-2026-10-26.md`](docs/engineering/project-audit-2026-10-26.md).

## P0 · Core promise: the draft must be correct and the run must not fail

- [ ] **Query expansion or the Jira search can abort the whole analysis** `P0` `B1` `B2`
  - **Context:** `gatherContext` awaits the expander and runs the Jira search without a catch (`src/core/context/gather.ts:28-33`). `termsSchema` is strict (`.min(5).max(10)`, `src/integrations/ai/generator.ts:23`), so a model returning 4 or 11 terms throws `NoObjectGeneratedError`. A JQL or network error fails the run the same way. Both steps only improve retrieval.
  - **Fix:** catch both, fall back to the heuristic terms and to no related issues, and log a warning. Relax `termsSchema` to accept 1 to 20 terms and truncate. Add unit tests in `tests/unit/analyze.test.ts` for a throwing expander and a throwing tracker.

- [ ] **Expanded terms never reach GitHub code search** `P0` `E6` `B4`
  - **Context:** `mergeTerms` appends model terms after the heuristic ones (`src/core/context/terms.ts:106-121`) and `GithubSource.searchContent` keeps only the first 3 terms (`src/integrations/github/source.ts:100-102`). With 3 or more heuristic terms the expansion only affects path scoring.
  - **Fix:** put the model terms first when searching (or interleave the two lists), keep the cap, and add a test in `tests/unit/github-source.test.ts` that a model term is searched. Re-measure recall (see "Measure retrieval recall after query expansion" in [`TODO-NON-CODE.md`](TODO-NON-CODE.md)).

- [ ] **Heuristic term extraction is English only** `P0` `B3`
  - **Context:** stopwords and synonyms in `src/core/context/terms.ts:6-83` are English. `extractTerms("Ajouter un bouton pour exporter les commandes en CSV…")` returns `["commandes","ajouter","bouton","pour","exporter","les","csv","sur","des"]`, and substring matching makes "les", "des", "est" and "sur" match almost every file.
  - **Fix:** use the `stopword` package (all languages) instead of the hand list, match terms under 5 characters on word boundaries, and add a French fixture with its expected files to `tests/fixtures/`.

- [ ] **No timeout, no retry on a malformed model response, no 429 handling** `P0` `B10` `B12`
  - **Context:** `AiGenerator.run` calls `generateText` with no `timeout` and no retry on `NoObjectGeneratedError` (`generator.ts:50-58`), and `jiraRequest` has no `AbortSignal` and ignores 429 (`src/integrations/jira/client.ts:64-76`). A hung provider holds the action until the 10-minute stale rule; one malformed response fails the analysis.
  - **Fix:** pass the AI SDK `timeout` (for example 120 s total), retry once on `NoObjectGeneratedError`, add `AbortSignal.timeout` to Jira requests and one retry on 429 honoring `Retry-After`.

## P1 · Prove it: evaluation and correctness fixes

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

## P3 · Polish and later

- [ ] **Alias resolution ignores `extends` in `tsconfig.json`** `P3` `B6`
  - **Context:** `parseAliasConfig` reads only the file's own `compilerOptions` (`src/core/context/paths.ts:61-76`), so aliases defined in a base config are not resolved and imported files are missed in monorepos.
  - **Fix:** follow relative `extends` through `source.readFile` (stop at package extends), and replace `parseJsonc` with `jsonc-parser`. Add a case to `tests/unit/retrieve.test.ts`.

- [ ] **The dark theme is unreachable** `P3` `B16`
  - **Context:** nothing sets the `.dark` class, so the dark variables in `src/app/globals.css` and every `dark:` class in `src/components/ui` never apply.
  - **Fix:** add a theme toggle (`next-themes`, with `prefers-color-scheme` as the default). The dark styles already exist, and a public portfolio should show them working. Delete them only if you decide not to offer a dark theme.
