import type { EvidenceSelector, TokenUsage } from "@/core/analysis/generators";
import type { Evidence } from "@/core/evidence/schemas";
import { extractTerms } from "./terms";
import { evidenceFromPaths, type EvidenceCandidate } from "./retrieve";
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
  selector: EvidenceSelector;
  excludeIssueKey?: string;
}): Promise<GatheredContext> {
  const terms = extractTerms(input.query);
  const [selection, issues] = await Promise.all([
    input.selector.select({ query: input.query, source: input.source }),
    terms.length ? relatedIssues(input.tracker, terms) : [],
  ]);
  const files = await evidenceFromPaths(selection.paths, terms, input.source);
  const related = issues.filter((issue) => issue.key !== input.excludeIssueKey).map(issueEvidence);
  const evidence = [...files, ...related].map((candidate, i) => ({ ...candidate, id: `e${i + 1}` }));
  return { evidence, usage: selection.usage };
}
