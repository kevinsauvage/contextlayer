Implement the next backlog item.

1. Read `TODO.md`, then the open items in `TODO-BUG.md`, `TODO-QUALITY.md`, `TODO-REFACTOR.md` and `TODO-FEATURE.md` (skip `TODO-NON-CODE.md` and `Deferred` items). Pick the highest-priority open item (lowest `P#`; on a tie prefer bug > quality > refactor > feature, then the smallest). If I named an item after this prompt, take that one instead.
2. Tell me in two lines which item you picked and your plan. Then proceed without waiting unless the item needs a decision only I can make (product scope, paid service, new infrastructure); in that case ask and stop.
3. Before writing code, read the files the item cites and the relevant guide in `node_modules/next/dist/docs/` or `node_modules/ai/docs/` if it touches Next.js or the AI SDK. Search npm before writing any helper.
4. Implement it following `AGENTS.md`. Add or update tests that would have failed before the change (`pnpm test tests/unit/<file>` while iterating).
5. Close the loop:
   - Remove the item from its `TODO-<KIND>.md` (or mark `[~]` and say what's left) and update the counts table in `TODO.md`.
   - Add an entry to `DECISIONS.md` if you made a non-obvious choice.
   - File anything you discovered but didn't fix as a new item in the right `TODO-<KIND>.md`, with **Context** and **Fix**.
6. Run `pnpm check` and fix every failure. Don't commit.
7. Reply with: the item, what changed (files), test evidence, and anything left open.
