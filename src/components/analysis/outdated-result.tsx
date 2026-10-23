import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function OutdatedResult({ subject, action }: { subject: string; action: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>This {subject} was created by an older version</AlertTitle>
      <AlertDescription>{action}</AlertDescription>
    </Alert>
  );
}
