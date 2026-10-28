"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { EvidenceIssue } from "@/core/evidence/validate";

// Only claims the editor owns can be jumped to; a finding lives in the report, not in a form.
const CLAIM_PATH = /^(description|acceptanceCriteria)\[\d+\]$/;

export function EvidenceWarnings({ issues, onSelect }: { issues: EvidenceIssue[]; onSelect?: (path: string) => void }) {
  if (!issues.length) return null;
  return (
    <Alert variant="destructive">
      <AlertTitle>Some claims do not match their evidence</AlertTitle>
      <AlertDescription>
        <p>Approval is blocked until these are fixed.</p>
        <ul className="list-disc pl-4">
          {issues.map((issue, index) => (
            <li key={index}>
              {onSelect && CLAIM_PATH.test(issue.path) ? (
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
      </AlertDescription>
    </Alert>
  );
}
