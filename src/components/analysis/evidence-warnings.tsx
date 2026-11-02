"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isBlockingIssue, isClaimPath, type EvidenceIssue } from "@/core/evidence/validate";

function IssueList({ issues, onSelect }: { issues: EvidenceIssue[]; onSelect?: (path: string) => void }) {
  return (
    <ul className="list-disc pl-4">
      {issues.map((issue, index) => (
        <li key={index}>
          {onSelect && isClaimPath(issue.path) ? (
            <button
              type="button"
              className="text-left underline underline-offset-2"
              onClick={() => onSelect(issue.path)}
            >
              {issue.message}
            </button>
          ) : (
            issue.message
          )}
        </li>
      ))}
    </ul>
  );
}

// Two kinds of issue, two titles: an unsupported quote blocks approval, an answered open question does not.
export function EvidenceWarnings({ issues, onSelect }: { issues: EvidenceIssue[]; onSelect?: (path: string) => void }) {
  const blocking = issues.filter(isBlockingIssue);
  const warnings = issues.filter((issue) => !isBlockingIssue(issue));
  return (
    <>
      {blocking.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>Claims don&apos;t match their evidence</AlertTitle>
          <AlertDescription>
            <p>Approval is blocked until these are fixed.</p>
            <IssueList issues={blocking} onSelect={onSelect} />
          </AlertDescription>
        </Alert>
      )}
      {warnings.length > 0 && (
        <Alert>
          <AlertTitle>Claims decide an open question</AlertTitle>
          <AlertDescription>
            <p>Answer the open question, or leave the value undecided, before publishing.</p>
            <IssueList issues={warnings} onSelect={onSelect} />
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
