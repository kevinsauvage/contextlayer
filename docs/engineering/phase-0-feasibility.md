# Phase 0 feasibility

Engineering feasibility of the integrations, retrieval, runtime and AI provider, based on the working prototype. Product viability is a separate question: [`../product/phase-0-decision.md`](../product/phase-0-decision.md). Setup steps: [`integrations-setup.md`](integrations-setup.md).

## Verdict

Feasible with the current architecture. The open engineering risks are retrieval recall on large or unusual repositories, GitHub and Jira failure handling, and synchronous analysis time. None blocks a pilot.

## GitHub

| Aspect             | Detail                                                                                                                                                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mechanism          | GitHub App with installation tokens (`octokit`); users install it on their own account or organization                                                                                                                                       |
| Permissions        | Repository: **Contents: read-only**, **Metadata: read-only**. No write access, no webhooks                                                                                                                                                   |
| Install flow       | OAuth during installation is required; the callback exchanges the `code` and checks the user's installations, because `installation_id` in the URL is attacker-controlled                                                                    |
| What is read       | Repository metadata, the default-branch file tree, and file contents on demand through the API                                                                                                                                               |
| Limits in the code | Files over 100 KB skipped; text extensions only; `node_modules`, build output and lockfiles ignored; a truncated recursive tree is rebuilt one paginated directory listing at a time; at most 5 terms sent to code search; top 20 files read |
| Not stored         | File contents. Only evidence excerpts cited in a draft are saved with the analysis                                                                                                                                                           |
| Open items         | The per-directory fallback costs one round trip per directory and its latency is not yet measured; code search is rate limited separately and used best effort; monorepo subdirectory scoping does not exist                                 |

Organization owners may need to approve the app. This is a likely procurement friction (H4) to test in interviews.

## Jira Cloud

| Aspect        | Detail                                                                                                                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mechanism     | Atlassian OAuth 2.0 (3LO) app; one connection per organization and site                                                                                                                                     |
| Scopes        | `read:jira-work`, `write:jira-work`, `offline_access`                                                                                                                                                       |
| Tokens        | Access and refresh tokens AES-256-GCM encrypted at rest. Atlassian rotates refresh tokens, so each refresh is persisted; a concurrent-refresh race is an open item in [`TODO.md`](../../TODO.md)            |
| Reads         | Issue by key (audit), related issues through JQL `text ~` (best effort)                                                                                                                                     |
| Writes        | Create an issue (type Task, else the first non-subtask type) or overwrite summary and description (audit apply). Both only after explicit approval; descriptions are converted to Atlassian Document Format |
| Not supported | Jira Server and Data Center; custom required fields on create; issue types other than the default                                                                                                           |

`write:jira-work` is broad (it also allows comments, transitions and edits). This is a procurement concern even though the app only creates issues and updates summary and description. Narrower scopes should be investigated before a pilot.

## Retrieval

Keyword scoring over file paths (weight 3) and content, with GitHub code search as a best-effort boost: read the top 20 and rescore, follow the top three files' imports one hop (relative, and aliases resolved through the repository's `tsconfig.json` `compilerOptions.paths`, with `@/` and `~/` as fallbacks) and through barrels, keep 60-line windows, give the model 8 candidates, add up to 5 related Jira issues. On the four fixtures it finds 9 of 10 expected files (misses `mail/send.ts` for "Add password reset"). Next steps in order: LLM query expansion, then measure recall on real repositories (experiment E6), and only then consider embeddings behind the `ContextSource` interface.

## Runtime and hosting

Analyses run inside a server action with `maxDuration = 300`. Measured on fixtures: 8 to 20 seconds per analysis. The cost is dominated by model latency, not retrieval. Risk: a large repository adds GitHub round trips in the same request. Add a job runner only when pilot data shows requests approaching the limit. Hosting is undecided; Vercel (Fluid compute) fits the Next.js app, with managed Postgres from the Marketplace.

## AI provider cost and quality

| Provider route                                   | Result on the four fixtures                                                                     |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Gemini 3.8 Flash (free tier)                     | 4 of 4 drafts valid; free tier rate limits interrupt multi-case runs                            |
| DeepSeek `deepseek-flash`, JSON mode             | 4 of 4 drafts valid; 8 to 20 s; about 1 to 3k output tokens per analysis. Cost not yet computed |
| Gateway free models (Nemotron 3.5, Laguna S 2.1) | Invalid structured output or rate limited; unusable for this task                               |
| OpenCode Go                                      | Not usable: licensed for coding-agent traffic and requires a session header                     |

Structured output works on endpoints with `json_schema` support; JSON mode with the schema in the prompt works on DeepSeek. A paid mid-tier model comparison (Claude, GPT, Gemini) with a separate judge model is the next measurement; record it in [`../product/validation-experiments.md`](../product/validation-experiments.md).

## Security and compliance

Source code and Jira text leave the system for the configured model provider. A customer-facing data-flow description, provider data-retention terms and a bring-your-own-key option are needed before a pilot with a security-conscious team. The threat model (prompt injection through repository or Jira content, tenant isolation, token handling) is Phase 3 work.
