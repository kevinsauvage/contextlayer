import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { EvidenceIssue } from "@/core/evidence/validate";

export function EvidenceWarnings({ issues }: { issues: EvidenceIssue[] }) {
  if (!issues.length) return null;
  return (
    <Alert variant="destructive">
      <AlertTitle>Evidence problems — review before publishing</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">
          {issues.map((issue, index) => (
            <li key={index}>
              {issue.path}: {issue.message}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
