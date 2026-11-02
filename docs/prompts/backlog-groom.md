Groom the backlog. Edit the `TODO*.md` files only.

For every open (`[ ]` or `[~]`) item in `TODO-BUG.md`, `TODO-FEATURE.md`, `TODO-QUALITY.md`, `TODO-REFACTOR.md` and `TODO-NON-CODE.md`:

1. Check it against the current code: do the cited `file:line` references still point at the right thing? Is it already done (search the code and `git log --oneline -30`)? Is it partly done (`[~]` with what's left)?
2. Check it's in the right file for its kind and has both **Context** and **Fix**. Rewrite vague items so someone could start without asking a question.
3. Re-check priority against the order in `TODO.md` (P0 core promise → P1 prove it → P2 production-grade → P3 polish). Flag items whose priority looks wrong rather than silently changing more than a step.
4. Merge duplicates. Split items too big to finish in one session.

Then remove closed items (shipped work lives in `git log` and `DECISIONS.md`), recount the "At a glance" table in `TODO.md`, update its "Last reviewed" date, and run `pnpm format`.

Reply with: closed, updated, merged/split, priority changes proposed, and the single item you'd do next.
