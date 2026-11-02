# Prompts

Reusable prompts for improving ContextLayer with Claude Code (or any coding agent that reads `AGENTS.md`). Each file is self-contained; project rules come from `AGENTS.md`, so the prompts don't repeat them.

## Run one

```bash
claude "$(cat prompts/next-todo.md)"          # interactive session
claude -p "$(cat prompts/bug-hunt.md)"         # headless, prints the result
```

Or, inside a session, type `@prompts/bug-hunt.md run this`.

Some prompts take a target. Append it after the file: `claude "$(cat prompts/code-review.md) Target: src/core/context"`.

## Catalogue

| Prompt                                           | Changes code | What it does                                                                     |
| ------------------------------------------------ | :----------: | -------------------------------------------------------------------------------- |
| [`next-todo.md`](next-todo.md)                   |     yes      | Picks the highest-priority open backlog item, implements it, closes it           |
| [`code-review.md`](code-review.md)               |      no      | Reviews the last commits (or a target) against the project rules                 |
| [`bug-hunt.md`](bug-hunt.md)                     |      no      | Reads the code for real defects and files them in `TODO-BUG.md`                  |
| [`security-audit.md`](security-audit.md)         |      no      | Prompt injection, tenant isolation, secrets, Jira write approval, SSRF           |
| [`test-gaps.md`](test-gaps.md)                   |     yes      | Finds untested `core` logic and adds focused unit tests                          |
| [`eval-improve.md`](eval-improve.md)             |     yes      | Strengthens eval cases and fixtures without spending tokens                      |
| [`refactor-cleanup.md`](refactor-cleanup.md)     |     yes      | Removes duplication, dead code and hand-written helpers a package already covers |
| [`ux-review.md`](ux-review.md)                   |      no      | Walks the main flows in the running app and files UX issues                      |
| [`docs-sync.md`](docs-sync.md)                   |     docs     | Fixes drift between docs and code                                                |
| [`dependency-upgrade.md`](dependency-upgrade.md) |     yes      | Upgrades outdated dependencies safely, one group at a time                       |
| [`backlog-groom.md`](backlog-groom.md)           |     docs     | Re-checks every open TODO item against the code and fixes the counts             |

## Suggested rhythm

- After a feature: `code-review.md`, then `docs-sync.md`.
- Weekly: `bug-hunt.md` or `security-audit.md` (rotate), then `backlog-groom.md`.
- When the backlog is clear: `test-gaps.md`, `eval-improve.md`, `refactor-cleanup.md`.
- Anytime: `next-todo.md`.

"Changes code: no" prompts only file findings in the matching `TODO-<KIND>.md`; run `next-todo.md` to act on them.
