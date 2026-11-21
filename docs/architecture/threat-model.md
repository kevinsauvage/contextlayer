# Threat model

This is a source-grounded architecture model for the application code at the revision below. It records trust boundaries, existing controls and unresolved scenarios; it is not a penetration test or proof that every route is safe. Scenarios describe ways a control could fail, not confirmed attacks.

## System and security goals

ContextLayer connects a customer's GitHub repository and Jira site, gathers selected code and ticket context, asks an AI provider to draft or audit a ticket, stores the result, and can publish a user-approved draft to Jira. The main security goals are:

- Keep one organization's projects, analyses and integration credentials inaccessible to another organization.
- Keep integration credentials and authentication secrets confidential.
- Treat repository, ticket and user-provided text as untrusted data, including instructions embedded in it.
- Publish only a draft the authorized user has reviewed, against the evidence and analysis run they saw.
- Bound resource use and make failed or incomplete analyses visible rather than treating them as valid results.

## Actors and assets

| Actor                                   | Access and trust                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Organization member                     | Can analyze and publish within the active organization; user intent is authenticated, but submitted draft fields are still untrusted. |
| Organization admin/owner                | Can manage integrations and organization settings.                                                                                    |
| Unauthenticated internet client         | Can reach public/authentication and OAuth callback routes; protected actions establish a session and organization context.            |
| GitHub, Jira, AI and database providers | External services that receive credentials or data and can fail, time out, or return malformed/unexpected responses.                  |
| Repository and ticket authors           | Can influence text ContextLayer retrieves. Their text is untrusted even when the author is a project member.                          |

Assets include sessions and Better Auth secrets; GitHub/Jira credentials; organization and project records; source and ticket excerpts; AI prompts, outputs and usage; evidence attached to drafts; and Jira writes.

## Data flow and trust boundaries

1. A signed-in user selects a project and starts an analysis. `requireOrgContext` validates the active organization membership and role ([session.ts](../../src/infrastructure/auth/session.ts#L31-L74)); project and analysis loading is scoped to that organization ([context.ts](../../src/features/analysis/context.ts#L23-L55)).
2. The integration resolver loads a connection using both its id and organization id ([resolve.ts](../../src/features/integrations/resolve.ts#L19-L45)). GitHub reads from a pinned commit and applies project subdirectory scope and readable-file filters ([source.ts](../../src/integrations/github/source.ts#L20-L25), [source.ts](../../src/integrations/github/source.ts#L80-L101)). Jira and repository text cross into the application as external, untrusted data.
3. Context is redacted for recognizable secret patterns before it reaches a model or is stored as an excerpt ([redact.ts](../../src/core/context/redact.ts#L1-L45)). The evidence agent also bounds reads, searches, files, steps and duration, checks read paths against the known repository path set, and labels retrieved text untrusted ([evidence-agent.ts](../../src/integrations/ai/evidence-agent.ts#L10-L38), [evidence-agent.ts](../../src/integrations/ai/evidence-agent.ts#L53-L119)). These measures reduce exposure and resource use; they do not make arbitrary text safe or guarantee all secrets are detected.
4. Model output is parsed through application schemas and evidence validation. Evidence ids and claims are checked against evidence retained for the run ([validate.ts](../../src/core/evidence/validate.ts#L27-L41), [validate.ts](../../src/core/evidence/validate.ts#L63-L76)). This establishes structural and citation constraints, not that a model's interpretation is factually correct.
5. Before an external Jira write, the server rebuilds evidence from the stored analysis rather than accepting browser-supplied evidence, checks the run token, and serializes the publish claim ([actions.ts](../../src/features/ticket-creation/actions.ts#L140-L187), [publish.ts](../../src/features/analysis/publish.ts#L14-L57)). Audit application also checks whether the Jira issue changed since the audit when an update timestamp is available ([actions.ts](../../src/features/ticket-audit/actions.ts#L50-L79)).

## Threat scenarios and current controls

### Prompt injection or misleading source content

**Scenario:** A repository file, issue description, or request contains instructions that try to change the model's task, leak secrets, or produce unsupported claims. The model may follow them or select misleading evidence.

**Controls:** Prompts label user requests and files as untrusted; retrieved file paths must be known; reads are bounded and redacted; generated output is schema- and evidence-checked; publishing requires an authenticated action. Injection evaluations cover a selected injection case and a control ([injection.eval.ts](../../tests/evaluation/injection.eval.ts#L9-L33)).

**Residual risk:** Prompt instructions are not a hard isolation boundary. Redaction is pattern-based, evidence validation does not prove semantic truth, and the current evaluation subset is not exhaustive. A plausible but unsupported draft can still need human correction.

### Cross-organization access

**Scenario:** A user changes a project, analysis, or integration id in a URL or form to access another organization's data or connection.

**Controls:** The session's active organization is checked against current membership; project and analysis reads are organization-scoped; connection resolution includes the organization id; integration changes require an organization admin ([session.ts](../../src/infrastructure/auth/session.ts#L35-L74), [context.ts](../../src/features/analysis/context.ts#L23-L55), [resolve.ts](../../src/features/integrations/resolve.ts#L19-L27), [actions.ts](../../src/features/integrations/actions.ts#L12-L27)).

**Residual risk:** This model is based on inspected paths, not exhaustive verification of every query or action. Any new server action must preserve the organization-scoped loading pattern.

### Forged OAuth callback or unauthorized integration change

**Scenario:** An attacker replays or alters OAuth state, tricks a user into connecting an account, or attempts to change an organization's provider credentials without admin rights.

**Controls:** OAuth state is HMAC-signed, compared in constant time, schema-checked and expires after ten minutes ([signed-state.ts](../../src/infrastructure/signed-state.ts#L6-L31)). Start and completion require admin context; completion binds state to the same user, organization and provider ([oauth-flow.ts](../../src/features/integrations/oauth-flow.ts#L20-L34), [oauth-flow.ts](../../src/features/integrations/oauth-flow.ts#L37-L67)).

**Residual risk:** Production provider registrations and callback URLs are recorded as misconfigured in the deployment backlog; the live provider configuration was not verified in this review ([TODO-NON-CODE.md](../../TODO-NON-CODE.md#L7-L9)).

### Credential exposure

**Scenario:** A database read, log, model prompt, or stored excerpt exposes an integration token or secret.

**Controls:** Stored integration tokens use AES-256-GCM with a random 12-byte IV and authentication tag ([crypto.ts](../../src/infrastructure/crypto.ts#L5-L23)); recognizable credential patterns are redacted before model use and stored excerpts ([redact.ts](../../src/core/context/redact.ts#L1-L45)); unexpected run errors shown to members are generic ([run.ts](../../src/features/analysis/run.ts#L23-L25)).

**Residual risk:** Encryption depends on protecting and rotating `ENCRYPTION_KEY` outside the database. Pattern redaction cannot guarantee removal of novel, obfuscated, or unrecognized secrets. This review did not inspect live secret storage, provider retention settings, or production logs.

### Unauthorized, stale, or duplicate Jira writes

**Scenario:** A modified browser request submits unreviewed content, an old tab publishes an obsolete draft, two requests create duplicates, or an audit overwrites a Jira issue changed since the audit.

**Controls:** Approved content is parsed against server-stored evidence; create flow checks the analysis run token; a database claim prevents concurrent duplicate publishing; audit flow compares Jira's current update time when available ([actions.ts](../../src/features/ticket-creation/actions.ts#L143-L187), [publish.ts](../../src/features/analysis/publish.ts#L24-L57), [actions.ts](../../src/features/ticket-audit/actions.ts#L67-L79)).

**Residual risk:** If Jira omits an update timestamp, the audit cannot detect intervening edits. If a provider times out after applying a write, the app cannot know whether it succeeded; it warns the user and retains the publish claim temporarily, but reconciliation may still require checking Jira ([publish.ts](../../src/features/analysis/publish.ts#L40-L55)).

### Resource exhaustion and AI spend

**Scenario:** An authenticated user or many concurrent users trigger expensive runs, repeated searches, or very large repository reads.

**Controls:** Better Auth has database-backed sign-in rate limiting ([auth.ts](../../src/infrastructure/auth/auth.ts#L14-L21)); analyses are capped per user and per deployment, and the evidence agent bounds its work ([limits.ts](../../src/features/analysis/limits.ts#L27-L57), [evidence-agent.ts](../../src/integrations/ai/evidence-agent.ts#L10-L22)). Runs have deadlines and token usage is recorded on success or failure ([run.ts](../../src/features/analysis/run.ts#L43-L75)).

**Control:** Run claims take a shared transaction-scoped advisory lock before checking limits and recording the run, serializing the short claim transaction across users ([limits.ts](../../src/features/analysis/limits.ts#L60-L75)). This protects the configured deployment-wide count across application instances sharing the database. The tradeoff is that simultaneous run claims briefly queue behind one another. A concurrent database regression test remains in [`TODO-BUG.md`](../../TODO-BUG.md).

## Operational questions not answered by source review

- Confirm production OAuth apps, callback URLs, external-account distribution and AI provider spending limits; the repository backlog says these are not production-ready, but deployment state was not accessed.
- Publish a customer-facing data-flow and retention statement. The code stores analysis results and excerpts, but this review did not establish a deletion or retention policy.
- Confirm production monitoring, incident response, backups, restore testing, secret rotation and provider data-retention settings. These require operational/account access.
- Narrow Jira OAuth scopes; the current backlog records broad work read/write scopes ([TODO-NON-CODE.md](../../TODO-NON-CODE.md#L19-L21)).

## Review boundary

This document is an architecture-level threat model from source inspection. It does not report a completed penetration test, exhaustive route audit, provider review, or deployment review. Revisit it when authentication, integrations, data retention, model providers, or publishing behavior changes.

Repository: https://github.com/kevinsauvage/contextlayer
Version: codex-security-snapshot/v1:sha256:796d8bf299afd2c40414d28073e3e08a2241968be77fd79ddab42f9e4b4958d3
