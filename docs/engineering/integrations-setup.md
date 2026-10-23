# Integrations setup

The app runs without these, but project creation and analysis need both. Local base URL: `http://localhost:3000` (`BETTER_AUTH_URL`).

## GitHub App

GitHub → Settings → Developer settings → GitHub Apps → New GitHub App.

| Field | Value |
| --- | --- |
| Callback URL | `{BASE}/api/github/callback` |
| Request user authorization (OAuth) during installation | **On** (required: proves the installer has access to the installation) |
| Setup URL / Webhook | none (uncheck "Active") |
| Repository permissions | Contents: Read-only · Metadata: Read-only |
| Where can it be installed | Any account |

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

- Authorization callback URL: `{BASE}/api/jira/callback`
- Permissions → Jira API: `read:jira-work`, `write:jira-work` (`offline_access` is requested at authorization)
- Distribution: sharing enabled when other organizations will connect.

```
JIRA_CLIENT_ID=
JIRA_CLIENT_SECRET=
```

Tokens are encrypted at rest with `ENCRYPTION_KEY` (AES-256-GCM). Atlassian rotates refresh tokens; each refresh is persisted.

## AI

Set either an OpenAI-compatible endpoint or the Vercel AI Gateway.

**Free tier (default for local experiments)** — Google AI Studio key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey), `GEMINI_API_KEY` equivalent:

```
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
AI_API_KEY=              # Google AI Studio key
AI_MODEL=gemini-2.5-flash
```

The same two variables point at any OpenAI-compatible provider — Groq
(`https://api.groq.com/openai/v1`), OpenRouter (`https://openrouter.ai/api/v1`),
or local Ollama (`http://localhost:11434/v1`, any `AI_API_KEY` value). The
endpoint must support structured outputs (`response_format: json_schema`),
which Gemini, Groq and Ollama do; free models that only emit loose JSON fail
draft validation.

**Vercel AI Gateway** — leave `AI_BASE_URL` unset and set `AI_GATEWAY_API_KEY`;
`AI_MODEL` is then any `provider/model` the gateway serves.

## Local database

`docker compose up -d` starts Postgres on port 5434; `pnpm db:migrate` applies `drizzle/` migrations.
