# TODO · Bugs

Existing behaviour that is wrong: it fails, or silently returns incomplete or incorrect results. Index and conventions: [`TODO.md`](TODO.md). Items from the 2026-10-26 review cite its finding id (for example `B1`) in [`docs/engineering/project-audit-2026-10-26.md`](docs/engineering/project-audit-2026-10-26.md).

## P3 · Later: optional features and deeper hardening

- [ ] **The dark theme is unreachable** `P3` `B16`
  - **Context:** nothing sets the `.dark` class, so the dark variables in `src/app/globals.css` and every `dark:` class in `src/components/ui` never apply.
  - **Fix:** add a theme toggle (`next-themes`, with `prefers-color-scheme` as the default). The dark styles already exist, and a public portfolio should show them working. Delete them only if you decide not to offer a dark theme.
