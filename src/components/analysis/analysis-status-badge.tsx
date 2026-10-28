import { LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Analysis } from "@/features/projects/queries";

type Claim = { status?: string };

// A completed run is only ready once nothing is left to decide; the result is untyped JSON, so read it defensively.
function completedLabel(result: unknown): "Provisional" | "Ready" {
  const draft = (result ?? {}) as { openQuestions?: unknown; description?: Claim[]; acceptanceCriteria?: Claim[] };
  const questions = Array.isArray(draft.openQuestions) ? draft.openQuestions.length : 0;
  const undecided = [...(draft.description ?? []), ...(draft.acceptanceCriteria ?? [])].some(
    (claim) => claim.status === "needs_clarification",
  );
  return questions || undecided ? "Provisional" : "Ready";
}

export function AnalysisStatusBadge({
  analysis,
}: {
  analysis: Pick<Analysis, "status" | "publishedIssueKey" | "kind" | "result">;
}) {
  if (analysis.publishedIssueKey) return <Badge variant="success">{analysis.publishedIssueKey}</Badge>;
  switch (analysis.status) {
    case "running":
      return (
        <Badge variant="secondary">
          <LoaderCircle className="animate-spin" /> Running
        </Badge>
      );
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "completed": {
      // A create row stores the draft itself; an audit row stores the report around its proposed ticket.
      const draft =
        analysis.kind === "create"
          ? analysis.result
          : (analysis.result as { proposedTicket?: unknown } | null)?.proposedTicket;
      const label = completedLabel(draft);
      return <Badge variant={label === "Ready" ? "outline" : "warning"}>{label}</Badge>;
    }
  }
}
