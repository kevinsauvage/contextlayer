Clean up the code without changing behaviour.

Scope: whatever I name after this prompt; otherwise all of `src`.

1. Run `pnpm knip` and `pnpm deps:check` and fix what they report.
2. Find duplication: near-identical functions, repeated Zod shapes, types redeclared instead of derived with `z.infer`, repeated form-reading or error-formatting that should use `formString()` / `firstIssueMessage()`, repeated UI patterns that belong in `src/components`.
3. Find hand-written helpers a maintained package already covers (retries, timeouts, parsing, dates, IDs, concurrency, text). For each, check npm weekly downloads, maintenance and types, and either swap it in or say why none fits.
4. Find complexity: functions over ~50 lines or with deep nesting, business logic sitting in route handlers or components instead of `src/core`, comments that restate code, non-null assertions that should handle `undefined`.
5. Make the changes in small steps, running the affected tests after each. Keep public behaviour and DB schema identical; if a cleanup needs a behaviour change, file it in `TODO-REFACTOR.md` instead.
6. Run `pnpm check`. Record any non-obvious choice in `DECISIONS.md`.

Reply with a list of changes grouped by kind, lines removed vs added, and packages added or rejected with the reason.
