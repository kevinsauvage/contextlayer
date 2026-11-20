# TODO · Bugs

Existing behaviour that is wrong: it fails, or silently returns incomplete or incorrect results. Index and conventions: [`TODO.md`](TODO.md). Items from the 2026-10-26 review cite its finding id (for example `B1`) in [`docs/engineering/project-audit-2026-10-26.md`](docs/engineering/project-audit-2026-10-26.md). Items from the 2026-11-02 code review and prompt run (`docs/prompts/`) were found by reading the code and the installed library sources; none was reproduced in a running app unless the item says so.

The 2026-11-20 portfolio review found four items by reading the code; none was reproduced in a running app. All four shipped on 2026-11-20: `errorSummary` in the organization actions with a lint rule against raw error logs, thrown-action recovery in `useMutation`, the clipboard fallback that still hands over the invitation link, and accessible names for the menus and loading states. Details in `DECISIONS.md` and `git log`.

No open bugs.
