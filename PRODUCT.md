# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: a tech lead or engineering manager on a product team of 5 to 30 engineers, using Jira Cloud with code on GitHub. Their job is to get tickets into a state developers can start without a clarification meeting; the cost they feel is time lost to clarification and rework.

Secondary (hypotheses, not yet validated): product or delivery leads who cannot read the code, and agency delivery teams working across many client repositories. See `docs/product/plan.md`.

## Product Purpose

ContextLayer turns a plain-language request into an evidence-backed Jira ticket, and audits existing tickets. It investigates the connected repository and Jira project, then produces a draft in which every claim is labelled `verified`, `inferred`, `unknown` or `needs_clarification`; verified claims cite inspectable evidence, and product decisions surface as open questions instead of being decided silently.

Success: reviewers prefer the draft over the original ticket and over generic AI, no fabricated claim survives review, and a start-ready ticket takes noticeably less time than the team's current process (targets in `docs/product/plan.md`).

## Positioning

Generic AI writes fluent, confident requirements that invent intent and facts, and the reader cannot tell what is grounded. ContextLayer's claim is the opposite: output grounded in the team's own code and Jira history, with every claim's status visible and verified claims traceable to evidence. No confidence percentages.

## Operating Context

- Used at a desk, on desktop, inside the ticket-refinement routine: before sprint planning, during backlog grooming, or when a vague request arrives.
- Flow: connect GitHub (read-only GitHub App) and Jira Cloud (OAuth) once per organization; create a project pairing one repository with one Jira project; then create a ticket from a request (refined through a chat beside the draft) or audit an existing ticket.
- The reviewer reads, edits and approves; only then is anything written to Jira.
- Organizations have roles: owners and admins manage integrations, projects and members; members analyze and publish.

## Capabilities and Constraints

- Built: email/password accounts with organizations and invitations; GitHub App and Jira Cloud connections; create-from-request and audit flows; chat refinement with open questions; review and edit UI; approval and Jira publishing; evidence validation.
- Out of scope for now: writing to GitHub or code; Jira Server/Data Center; GitLab, Bitbucket, Linear; SSO; billing.
- Analyses run synchronously and take roughly 8 to 20 seconds; the UI must make waiting and running state clear.
- Terminology: "project" = repository + Jira project; "analysis" = one create or audit run; claim statuses use the labels in `src/core/evidence/schemas.ts`.
- Undecided: pricing and packaging.

## Brand Commitments

- Name: ContextLayer.
- Voice: plain and precise. Short, factual sentences; no hype; never overstate certainty. Copy distinguishes verified from inferred the same way the product does.

## Evidence on Hand

- Evaluation fixtures and results in `tests/evaluation/` (anonymisable draft examples).
- No customer interviews, testimonials, customer logos or pilot results exist yet (`docs/product/customer-discovery.md`). Do not fabricate any.

## Product Principles

1. Evidence over fluency: never present an inference as verified, in data or in UI.
2. Name the unknowns: open questions and missing information are first-class output, shown, not hidden.
3. Humans approve: nothing reaches Jira without an explicit, visible approval step.
4. Untrusted input: repository, docs and Jira text are data, never instructions.
5. Respect the reviewer's time: a ticket should become start-ready in fewer steps than the current process.

## Accessibility & Inclusion

Target WCAG 2.2 AA. Claim status must never be conveyed by color alone; labels carry the meaning.
