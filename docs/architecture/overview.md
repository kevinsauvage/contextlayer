# Architecture overview

ContextLayer is a modular monolith: one Next.js application, one Postgres database, no queue or worker. Analyses run inside a server action (`maxDuration = 300`). See [`DECISIONS.md`](../../DECISIONS.md) for why.

## Layers

```
app ─▶ features ─▶ core ◀─ integrations
          │                    │
          └──▶ infrastructure ◀┘
components ─▶ features (actions), core (types), infrastructure/auth/client
```

| Layer            | Contains                                                                                       | May import                                      |
| ---------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `core`           | Schemas, retrieval, evidence validation, analysis pipeline, interfaces                         | `core`, `zod` only                              |
| `features`       | Use cases: server actions, queries, orchestration                                              | `core`, `infrastructure`, `integrations`, `lib` |
| `integrations`   | Provider registry; GitHub, Jira, AI SDK and filesystem adapters implementing `core` interfaces | `core`, `infrastructure`, `lib`                 |
| `infrastructure` | Env validation, database, auth, crypto, signed OAuth state                                     | `infrastructure`, `lib`                         |
| `app`            | Routes, layouts, thin API handlers                                                             | anything below                                  |
| `components`     | UI; calls feature actions, uses the browser auth client                                        | `features`, `core`, `components`, `lib`         |
| `lib`            | Dependency-free helpers (`first`, `formString`, `firstIssueMessage`, `safePath`, `isUuid`)     | nothing                                         |

`eslint.config.mjs` enforces these rules with `no-restricted-imports`, plus `import/no-cycle`. `core` is kept pure so the whole analysis pipeline runs in tests with fakes for the source, the tracker and the generator.

## The analysis pipeline

Two use cases share one pipeline (`src/core/analysis/analyze.ts`):

1. **Create** (`draftTicket`): request (one line to a few paragraphs) plus any answers to earlier questions → candidates → draft. The drafted ticket gets its own concise title.
2. **Audit** (`auditIssue`): Jira issue key → fetch issue → candidates → report with findings and a proposed ticket.

```
input ─▶ extractTerms ─▶ gatherContext ─▶ generator ─▶ attach evidence ─▶ validate references
         (≤ 10 terms + synonyms) files + imports +   (LLM, Zod-typed)  (cited ids only)  (EvidenceIssue[])
                                 related issues
```

- **Terms** (`src/core/context/terms.ts`): quoted text (the requested new value) is ignored, accents are folded, stopwords and edit verbs are dropped, and a small UI synonym map adds terms ("banner" → hero, header).
- **Retrieval** (`src/core/context/retrieve.ts`): path scoring (weight 3) plus content scoring that counts capped term occurrences; test files rank below source and up to 10 candidates are kept. Optional provider search (GitHub code search: one query per term, best effort) only decides which files to read, and import following (`src/core/context/imports.ts`) reads the top three files' local imports one hop (through barrel `index` files) because copy and config usually live in an imported module. Read the top 20, rescore, keep 60-line windows. Related Jira issues come from `IssueTracker.searchRelated`. Every candidate gets an id `e1…eN`.
- **Generation** (`src/integrations/ai`): the model receives the candidates and returns a body that cites candidate ids. It never writes evidence. The pipeline attaches the real excerpts for the ids that were cited, which prevents fabricated sources.
- **Validation** (`src/core/evidence/validate.ts`): a schema-valid draft can still cite nothing, cite unknown ids, or mark a claim `verified` without evidence. Those become `EvidenceIssue`s, stored with the analysis and shown in the review UI.
- **Clarification**: open questions are answered on the draft page; a question may offer two to four options with one recommended, plus free text. Answers are stored in `analysis.input.answers`, merged across rounds, and the draft is regenerated in place. Blank answers stay as open questions.
- **Approval**: the user reviews a preview rendered from `ticketSections` (the same structure sent to the tracker) and can edit the draft; edits autosave and are restored on reload, a redraft asks before replacing them, and `parseApprovedDraft` re-validates schema and evidence before anything is published. Tracker writes happen only from the publish and apply actions.

## Claims and evidence

Every statement in a draft is a claim with a status: `verified | inferred | unknown | needs_clarification`. `verified` requires at least one evidence id; there are no confidence percentages. Evidence has a kind (`code | documentation | decision | jira_issue`), a reference, an optional URL and line range, and the excerpt that was actually read.

## Data model

Better Auth owns users, sessions, organizations, members and invitations (`src/infrastructure/db/schema/auth.ts`). Users switch organizations from the header; invitations are shared as links (`/invitations/<id>`) until an email provider exists. Owners and admins manage members and roles, a member can leave an organization, and an owner can delete one after typing its name. The organization is the tenant boundary: every query in `src/features` is scoped by `organizationId`, and `tests/integration/tenant-isolation.test.ts` proves it against PGlite running the real migrations.

| Table                    | Purpose                                                                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `integration_connection` | One connected account per provider (GitHub installation, Jira site): label, metadata, status, encrypted tokens, `grant_id` shared by a consent                    |
| `project`                | One source connection + resource (repository) and one tracker connection + resource (Jira project), with display labels                                           |
| `analysis`               | Input (request, answers and follow-ups, or issue key), AI result, user-edited result, evidence issues, model, tokens, latency, error, published issue key and URL |

## Integrations

Providers live behind two `core` contracts (`src/core/integrations/provider.ts`): a `SourceProvider` opens a `ContextSource` for a resource, a `TrackerProvider` opens an `IssueTracker` and parses issue keys. Both share the connect flow (`authorizeUrl`, `complete`, optional `refresh`) and `listResources`. `src/integrations/registry.ts` lists the providers; everything else is generic:

- Routes: `/api/integrations/[provider]/connect`, `/api/integrations/[provider]/callback` and `/api/integrations/connections/[id]/resources`.
- `src/features/integrations`: storing accounts (`connections.ts`), the OAuth flow with provider-bound, return-path-carrying state (`oauth-flow.ts`), token access with a grant-level row lock so rotating refresh tokens are never used twice (`access.ts`), and resolving a project's connections (`resolve.ts`).
- UI: the integrations page and the new-project wizard render from `integrationsOverview`, so a new provider appears without UI changes.

To add a provider (GitLab, Bitbucket, Linear, Azure Boards…): implement `SourceProvider` or `TrackerProvider` in `src/integrations/<name>/provider.ts`, add it to the registry, add its env vars to `src/infrastructure/env.ts` and `.env.example`, and register `{BASE}/api/integrations/<id>/callback` with the provider.

## Security model

- **Untrusted content**: repository files, docs and Jira text are data. They reach the model only as quoted candidates, the system prompt states they cannot change rules, and the approval step is independent of model output.
- **Secrets**: integration tokens are encrypted at rest (`ENCRYPTION_KEY`); OAuth `state` is HMAC-signed, bound to user, organization and provider, carries a same-origin return path, and is valid 10 minutes; a connection whose refresh is rejected is marked `needs_reconnect`; the GitHub install callback exchanges the OAuth `code` because `installation_id` in the URL is attacker-controlled.
- **Source code handling**: files are read on demand through the GitHub API and sent to the configured AI provider. They are not stored; only evidence excerpts cited by a draft are kept.
- **Access**: `src/proxy.ts` redirects unauthenticated requests; `requireOrgContext` and `requireOrgAdmin` guard actions; creating projects, managing integrations and inviting members need an owner or admin. An exclusive account (a GitHub installation) can belong to one organization only.
- **Headers**: `next.config.ts` sets `nosniff`, `X-Frame-Options: DENY`, a strict referrer policy and a restrictive permissions policy. A Content Security Policy is open work ([`TODO-FEATURE.md`](../../TODO-FEATURE.md)).

## AI provider seam

`resolveModel` (`src/integrations/ai/model.ts`) returns a plain `provider/model` string for the Vercel AI Gateway, or an OpenAI-compatible model when `AI_BASE_URL` is set. `AI_STRUCTURED_OUTPUTS=false` switches to JSON mode with the schema appended to the instructions for endpoints that reject `json_schema`. Zod validates the output either way.

## Testing strategy

| Kind        | Location            | Runs in `pnpm check` | Notes                                                                                                      |
| ----------- | ------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------- |
| Unit        | `tests/unit`        | yes                  | Pure logic with fake generator, source and tracker                                                         |
| Integration | `tests/integration` | yes                  | PGlite with the real Drizzle migrations; tenant isolation, connections and token refresh, analysis re-runs |
| Evaluation  | `tests/evaluation`  | no (`pnpm eval`)     | Real model on `tests/fixtures`; analysis quality and baseline comparison                                   |
