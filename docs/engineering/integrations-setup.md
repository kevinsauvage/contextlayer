# Integrations setup

The app runs without these, but project creation and analysis need a code source and an issue tracker. An unconfigured provider shows as "Not configured" on the Integrations page. Local base URL: `http://localhost:3000` (`BETTER_AUTH_URL`).

> Callback URLs moved to `/api/integrations/<provider>/callback` (2026-10-23). Update an existing GitHub App or Atlassian app accordingly.

## GitHub App

GitHub → Settings → Developer settings → GitHub Apps → New GitHub App.

| Field                                                  | Value                                                                  |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| Callback URL                                           | `{BASE}/api/integrations/github/callback`                              |
| Request user authorization (OAuth) during installation | **On** (required: proves the installer has access to the installation) |
| Setup URL / Webhook                                    | none (uncheck "Active")                                                |
| Repository permissions                                 | Contents: Read-only · Metadata: Read-only                              |
| Where can it be installed                              | Any account                                                            |

Then generate a private key and a client secret, and set:

```
GITHUB_APP_ID=            # App ID
GITHUB_APP_SLUG=          # from github.com/apps/<slug>
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
GITHUB_APP_PRIVATE_KEY=   # PEM contents, newlines written as \n
```

Source code is read through the API on demand and sent to the configured AI provider; it is not stored (only evidence excerpts cited by a draft are kept in the analysis row).

## Atlassian (Jira Cloud) OAuth 2.0 (3LO)

developer.atlassian.com → Console → Create → OAuth 2.0 integration.

- Authorization callback URL: `{BASE}/api/integrations/jira/callback`
- Permissions → Jira API: `read:jira-work`, `write:jira-work` (`offline_access` is requested at authorization)
- Distribution: sharing enabled when other organizations will connect.

```
JIRA_CLIENT_ID=
JIRA_CLIENT_SECRET=
```

Tokens are encrypted at rest with `ENCRYPTION_KEY` (AES-256-GCM). Atlassian rotates refresh tokens: one consent returns every accessible site, those connections share a `grant_id`, and a refresh locks and updates the whole grant. A rejected refresh marks the connection "Reconnect required".

## AI

Pick one route. Both are read in `src/integrations/ai/model.ts`.

**Vercel AI Gateway (default)**: leave `AI_BASE_URL` blank, set `AI_GATEWAY_API_KEY`, and set `AI_MODEL` to any `provider/model` id the gateway serves (for example `anthropic/claude-sonnet-5.5`). Some gateway models are free but weak at structured output or rate limited; paid credits unlock the rest.

**OpenAI-compatible endpoint**: set `AI_BASE_URL`, `AI_API_KEY` and `AI_MODEL` (that provider's own model id).

| Provider         | `AI_BASE_URL`                                             | Example `AI_MODEL` | `AI_STRUCTURED_OUTPUTS` | Notes                                                        |
| ---------------- | --------------------------------------------------------- | ------------------ | ----------------------- | ------------------------------------------------------------ |
| Google AI Studio | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-3.8-flash` | `true`                  | Free tier; hits rate limits during `pnpm eval`               |
| DeepSeek         | `https://api.deepseek.com/v1`                             | `deepseek-flash`   | `false`                 | Paid; needs a topped-up balance. List ids with `GET /models` |
| Groq             | `https://api.groq.com/openai/v1`                          | provider-specific  | `true`                  | Free tier                                                    |
| OpenRouter       | `https://openrouter.ai/api/v1`                            | provider-specific  | provider-specific       |                                                              |
| Ollama           | `http://localhost:11434/v1`                               | any local model    | `true`                  | `AI_API_KEY` can be any value                                |

`AI_STRUCTURED_OUTPUTS=true` (default) sends `response_format: json_schema`. Endpoints that reject it (DeepSeek: "This response_format type is unavailable now") need `false`: the schema is then appended to the instructions and the model answers in JSON mode. Zod validates the result either way, and weaker models fail validation more often.

**Evaluation judge**: `pnpm eval` scores drafts with a second model so the generator does not grade its own output. Set `AI_JUDGE_MODEL` to a different model id. If the judge lives on another endpoint (a gateway key cannot be combined with a DeepSeek-only base URL), set `AI_JUDGE_BASE_URL` and `AI_JUDGE_API_KEY` too; `AI_JUDGE_STRUCTURED_OUTPUTS` follows that endpoint's capabilities. Every unset judge variable falls back to its `AI_*` counterpart, and the run warns and records `judgeIsGenerator` when the judge is the generator. Example: generator DeepSeek, judge `gemini-3.8-flash` with the Google AI Studio base URL above and `AI_JUDGE_STRUCTURED_OUTPUTS=true`.

Do not point the app at an OpenCode Go key. Go is licensed for coding-agent traffic and requires an `x-opencode-session` header, which a ticket-drafting service does not fit. OpenCode Zen (pay-as-you-go) has no such restriction.

Source code and Jira text are sent to the configured provider. Choose one whose data policy fits your customers.

## Local database

`pnpm db:up` starts Postgres on port 5434 (credentials in `docker-compose.yml` and `.env.example`); `pnpm db:migrate` applies the `drizzle/` migrations.
