# ContextLayer: product and engineering plan (v0.3)

Status: working plan reconstructed from the repository, `AGENTS.md`, `TODO.md` and the evaluation results. Items marked **hypothesis** have not been validated with users; see [`business-hypotheses.md`](business-hypotheses.md) and [`validation-experiments.md`](validation-experiments.md). The original v0.2 planning document was not committed; if it still exists, reconcile it with this file.

## Problem

Tickets reach developers as a title and a sentence. Someone then investigates code, past decisions and related issues before the work can start, or the developer builds from an assumption that turns out to be wrong. Generic AI makes this worse in one specific way: it writes fluent, confident requirements that invent business intent and technical facts, and the reader cannot tell which parts are grounded.

## Product

Given a title, ContextLayer investigates the connected repository and Jira project and produces a draft ticket in which **every claim is labelled** (`verified`, `inferred`, `unknown`, `needs_clarification`), `verified` claims cite inspectable evidence, and product decisions are surfaced as open questions instead of being decided silently. A second mode audits an existing ticket for ambiguity, missing or non-testable acceptance criteria, conflicts with the code, duplicates and unsupported assumptions, and proposes an improved version.

Nothing is written to Jira until a person reviews, edits and approves.

## Users (hypothesis)

| Role                                | Job to be done                                                  | Why they care                                          |
| ----------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| Tech lead / engineering manager     | Get tickets into a state developers can start without a meeting | Time lost to clarification and rework                  |
| Product manager / delivery lead     | Turn a request into a ticket that is technically grounded       | Cannot read the code; fears specifying the wrong thing |
| Agency or consultancy delivery team | Same, across many client repositories                           | Context switching between unfamiliar codebases         |

The first segment to validate is small agencies and product teams on Jira Cloud with code on GitHub: the integrations the prototype supports.

## Principles

1. **Evidence over fluency.** Never present an inference as verified.
2. **Schema-valid is not true.** Validate AI output with Zod, then validate evidence references.
3. **Humans approve.** Jira writes only after explicit approval.
4. **Name the unknowns.** Product decisions and missing information are first-class output. No confidence percentages.
5. **Untrusted input.** Repository, docs and Jira text are data, never instructions.
6. **Measure before building.** No vector database, worker service or broker until a measured need.

## Scope

In scope (built): email and password accounts with organizations; GitHub App (read-only Contents and Metadata) and Jira Cloud OAuth connections; project = repository + Jira project; create-from-title and audit-existing-ticket flows; review and edit UI; approval and Jira publishing; evidence validation; evaluation harness and fixtures.

Out of scope for now: writing to GitHub, pull requests or code changes; Jira Server and Data Center; GitLab and Bitbucket; Linear and other trackers; embeddings and vector search; background jobs; billing; SSO.

## Success metrics (proposed)

| Metric                            | Target to justify continuing                                           | How measured                                            |
| --------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| Draft quality vs. original ticket | Reviewers prefer the draft in at least 7 of 10 cases                   | Rubric ([`evaluation-rubric.md`](evaluation-rubric.md)) |
| Fabricated claims                 | 0 forbidden claims on the fixtures; none found in reviewer spot-checks | Fixture `forbiddenClaims`, human review                 |
| Retrieval recall                  | At least 90% of expected files on fixtures                             | `retrievalRecall` in eval results                       |
| Time to a start-ready ticket      | At least 30% less than the team's current process                      | Pilot timing                                            |
| Cost and latency per analysis     | Under 2 minutes and a few cents on a mid-tier model                    | `analysis` table (tokens, latency)                      |
| Adoption in a pilot               | Pilot users create tickets with it unprompted in week 3                | Usage in the `analysis` table                           |

## Phases

| Phase | Goal                                 | Exit criterion                                                       | State                                                 |
| ----- | ------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------- |
| 0     | Prove the idea is worth building     | [`phase-0-decision.md`](phase-0-decision.md) criteria met            | Open                                                  |
| 1     | Prove the product (pipeline quality) | Baseline comparison and retrieval targets met on 8 to 10 fixtures    | In progress                                           |
| 2     | Connect and deliver                  | A real team can connect, analyze and publish end to end              | Built; needs real-credential and failure-path testing |
| 3     | Harden and validate                  | Threat model, regression coverage, history and metrics, private beta | Not started                                           |

## Main risks

- **Value**: teams may judge the draft only slightly better than a good prompt in their own AI tool. Mitigation: the baseline comparison and pilot interviews.
- **Trust**: one fabricated claim that survives review can end a pilot. Mitigation: evidence validation, labelled claims, forbidden-claim fixtures.
- **Retrieval quality**: keyword retrieval misses relevant files (9 of 10 expected on the fixtures). Mitigation: LLM query expansion, then embeddings only if measured recall demands it.
- **Data sensitivity**: source code goes to a third-party model provider. Mitigation: documented data flow, provider choice, no code stored.
- **Integration friction**: GitHub App and Atlassian OAuth setup may be a barrier. Mitigation: pilot observation; see [`../engineering/phase-0-feasibility.md`](../engineering/phase-0-feasibility.md).
- **Cost and runtime**: analyses run synchronously inside a request. Mitigation: measure latency in the pilot before adding a job runner.
