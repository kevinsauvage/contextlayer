import { GitCommitHorizontal } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function RevisionNotice({ change }: { change: { from: string; to: string } | null }) {
  if (!change) return null;
  return (
    <Alert>
      <GitCommitHorizontal aria-hidden />
      <AlertTitle>The code changed since the previous draft</AlertTitle>
      <AlertDescription>
        <p>
          This draft read commit <code>{change.to}</code>; the one it replaced read <code>{change.from}</code>. Check
          that its evidence still says what you expect before approving.
        </p>
      </AlertDescription>
    </Alert>
  );
}
