---
name: close-backlog-item
description: Use when starting, continuing or finishing an item in this repository's TODO.md or TODO-<KIND>.md backlog, including choosing the next item, implementing it with tests, running the gates, and updating the backlog and decisions.
---

# Close a backlog item

1. Read `AGENTS.md`, `TODO.md`, the item's `TODO-<KIND>.md` and `DECISIONS.md`; check `git status` and the current branch.
2. Pick the smallest next item that is not blocked by credentials, hosting access or a product decision. Respect the order P0 → P1 → P2 → P3 and say why the item is next.
3. Plan the files and tests before editing; keep the change inside the item's scope.
4. Implement with the conventions in `AGENTS.md`: `core` first, Zod at boundaries, no duplication or dead code.
5. Add or update the unit, integration, component or e2e tests that prove the item. Do not close an item with an untested behavior change.
6. Verify with `pnpm check`. For UI or server flows, also run `pnpm e2e` (`pnpm db:up` first; it builds and starts on port 3100). Run `pnpm test:coverage` when the change affects covered code.
7. Close the item: remove it from its file, update the counts in `TODO.md`, and record any non-obvious choice in `DECISIONS.md`. Run `pnpm format`.
8. Do not commit, push or open a PR without an explicit go-ahead. Report the changed files, the gates that ran and any remaining risk.
