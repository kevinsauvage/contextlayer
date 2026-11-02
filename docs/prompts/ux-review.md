Review the product experience in the running app. Don't change code; file findings.

1. Read `PRODUCT.md` for the target user and their job. Start the app (`pnpm db:up`, `pnpm dev`) and use the fake providers the e2e smoke test uses (`tests/e2e/smoke.spec.ts`) so no real Jira, GitHub or model is needed.
2. Walk these flows in the browser, taking a screenshot at each step: sign up → onboarding → connect integrations → create a project → draft a ticket from a plain request → answer clarifications → review evidence → approve and publish; then audit an existing ticket.
3. At each step note: is the next action obvious, does the user know what the AI verified versus inferred, are loading, empty and error states clear, is anything slow without feedback, is copy jargon-heavy, does it work at 375px wide and with keyboard only, are contrast and focus visible.
4. Judge against the user in `PRODUCT.md`: a tech lead who wants a ticket a developer can start without a meeting. Flag anything that adds friction to that or that could make them trust an unverified claim.

File each issue in `TODO-FEATURE.md` (or `TODO-BUG.md` if broken) with the screenshot step, **Context** and **Fix**, priority `P2` for trust or blocking issues and `P3` for polish. Update `TODO.md` counts and run `pnpm format`. Reply with the top 5 issues and a one-line verdict per flow.
