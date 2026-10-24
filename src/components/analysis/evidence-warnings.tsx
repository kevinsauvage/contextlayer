import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { EvidenceIssue } from "@/core/evidence/validate";

export function EvidenceWarnings({ issues }: { issues: EvidenceIssue[] }) {
  if (!issues.length) return null;
  return (
    <Alert variant="destructive">
      <AlertTitle>Some claims do not match their evidence</AlertTitle>
      <AlertDescription>
        <p>Fix these in Edit before approving. Approval is blocked until they are resolved.</p>
        <ul className="list-disc pl-4">
          {issues.map((issue, index) => (
            <li key={index}>{issue.message}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
