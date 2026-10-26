import type { QueryExpander, TokenUsage } from "@/core/analysis/generators";
import type { Evidence } from "@/core/evidence/schemas";
import { extractTerms, mergeTerms } from "./terms";
import { retrieveFileEvidence, type EvidenceCandidate } from "./retrieve";
import type { ContextSource, Issue, IssueTracker } from "./source";

const RELATED_ISSUE_LIMIT = 5;
const ISSUE_EXCERPT_CHARS = 1500;

function issueEvidence(issue: Issue): EvidenceCandidate {
  return {
    kind: "jira_issue",
    reference: issue.key,
    url: issue.url,
    excerpt: `${issue.summary} [${issue.status}]\n${issue.description}`.trim().slice(0, ISSUE_EXCERPT_CHARS),
  };
}

async function relatedIssues(tracker: IssueTracker, terms: string[]): Promise<Issue[]> {
  try {
    return await tracker.searchRelated(terms, RELATED_ISSUE_LIMIT);
  } catch (error) {
    console.warn("[context] related issue search failed; continuing without related issues", error);
    return [];
  }
}

export type GatheredContext = { evidence: Evidence[]; usage?: TokenUsage };

export async function gatherContext(input: {
  query: string;
  source: ContextSource;
  tracker: IssueTracker;
  excludeIssueKey?: string;
  expander?: QueryExpander;
}): Promise<GatheredContext> {
  const expanded = await input.expander?.expandTerms(input.query).catch((error: unknown) => {
    console.warn("[context] query expansion failed; using the request's own terms", error);
    return undefined;
  });
  const terms = mergeTerms(extractTerms(input.query), expanded?.terms ?? []);
  const [files, issues] = await Promise.all([
    retrieveFileEvidence(terms, input.source),
    terms.length ? relatedIssues(input.tracker, terms) : [],
  ]);
  const related = issues.filter((issue) => issue.key !== input.excludeIssueKey).map(issueEvidence);
  const evidence = [...files, ...related].map((candidate, i) => ({ ...candidate, id: `e${i + 1}` }));
  return { evidence, usage: expanded?.usage };
}
