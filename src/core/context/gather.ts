import type { Evidence } from "@/core/evidence/schemas";
import { extractTerms, retrieveFileEvidence, type EvidenceCandidate } from "./retrieve";
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

export async function gatherContext(input: {
  query: string;
  source: ContextSource;
  tracker: IssueTracker;
  excludeIssueKey?: string;
}): Promise<Evidence[]> {
  const terms = extractTerms(input.query);
  const [files, issues] = await Promise.all([
    retrieveFileEvidence(terms, input.source),
    terms.length ? input.tracker.searchRelated(terms, RELATED_ISSUE_LIMIT) : [],
  ]);
  const related = issues.filter((issue) => issue.key !== input.excludeIssueKey).map(issueEvidence);
  return [...files, ...related].map((candidate, i) => ({ ...candidate, id: `e${i + 1}` }));
}
