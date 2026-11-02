Hunt for bugs in this codebase. Don't fix them; file them.

Focus area: whatever I name after this prompt; otherwise rotate through `src/core/context`, `src/core/analysis`, `src/features/ticket-creation`, `src/features/ticket-audit` and `src/integrations`, starting with the area with the most commits since the last entry in `TODO-BUG.md` or `docs/engineering/project-audit-2026-10-26.md`.

Look for:

- Edge cases: empty repos, huge files, binary files, non-UTF-8 text, no search hits, GitHub rate limits (`failedTerms`), Jira fields missing or in ADF.
- AI output paths: schema-valid but wrong (evidence pointing at lines that don't exist, duplicate claims, status `verified` with empty evidence), truncated or refused responses, retries that double-charge or double-write.
- Server actions and DB: missing transactions, partial writes on failure, unscoped queries, unique-constraint races, timezone handling.
- Error handling: errors swallowed, generic messages hiding the cause, user-facing text leaking internals.

Verify each suspect by reading the callers and, where cheap, writing a throwaway failing test (delete it afterwards). Check the installed library source in `node_modules` before claiming a library behaves a certain way.

File each confirmed bug in `TODO-BUG.md` in the format its existing items use (title, `P#` tag, **Context** with `file:line` and the failure scenario, **Fix**) and update the counts in `TODO.md`. Run `pnpm format`. Reply with a table: title, priority, file, confidence (reproduced / read-only).
