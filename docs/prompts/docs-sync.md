Bring the docs back in line with the code. Edit docs only.

1. List docs changed less recently than the code they describe: compare `git log -1 --format=%cs` for `README.md`, `AGENTS.md`, `PRODUCT.md`, `docs/architecture/overview.md`, `docs/engineering/*.md` and `tests/fixtures/README.md` against the source folders they cover.
2. For each, check every concrete claim against the code: commands and scripts in `package.json`, env vars in `.env.example` and `src/infrastructure`, folder names and layer rules in `.dependency-cruiser.cjs`, data model in `drizzle/`, setup steps, flows and screens that were renamed or removed.
3. Fix what's wrong or missing. Keep each doc's voice and length; delete stale sections instead of piling on caveats. Don't touch the generated Next.js block at the top of `AGENTS.md`.
4. Check `DECISIONS.md` for decisions the code has since reversed and add a dated follow-up entry rather than editing history.
5. Run `pnpm format:check`.

Reply with a table: doc, what was wrong, what you changed.
