Run a security audit of this app. Don't change source files; file findings.

Cover each area, citing `file:line`:

1. **Prompt injection:** trace every path where repo files, docs, Jira descriptions or comments reach a model prompt. Are they delimited and labelled untrusted? Can injected text change tool calls, mark claims `verified`, trigger a Jira write or leak another org's data? Compare with `tests/evaluation/injection.eval.ts` and its fixtures; list attack shapes not covered.
2. **Authorization and tenant isolation:** for every server action, route handler and data loader, confirm the session is checked and every query is scoped to the caller's organization and role (`src/core/organizations/roles.ts`). Look for IDs taken from form data or URLs without an ownership check (IDOR).
3. **Jira and GitHub writes:** confirm no write path runs without an explicit user approval step, and that the approved payload is the one sent (no re-generation between approval and write).
4. **Secrets and tokens:** OAuth tokens encrypted at rest, never logged, never sent to the client or the model; `.env.example` complete; nothing secret in `NEXT_PUBLIC_*`.
5. **Outbound requests:** any user-controlled URL or host (SSRF), redirects followed, timeouts set.
6. **Web:** CSRF on mutations, security headers in `next.config.ts` / `src/proxy.ts`, cookie flags, open redirects after sign-in, XSS through rendered Markdown or ticket text.
7. **Abuse:** unbounded inputs (request length, file count, chat turns) that inflate model spend.

Rank findings by exploitability × impact. File each in `TODO-BUG.md` (broken now) or `TODO-FEATURE.md` (missing control) with **Context** and **Fix**, merge with existing items like "Content Security Policy" instead of duplicating, update `TODO.md` counts and run `pnpm format`. Reply with the ranked list and what you checked and found clean.
