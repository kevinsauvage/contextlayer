import { LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isBlockingIssue } from "@/core/evidence/validate";
import { draftReadiness } from "@/core/requirements/readiness";
import { storedDraft } from "@/features/analysis/read";
import type { Analysis } from "@/features/projects/queries";

// A completed run is only ready once nothing is left to decide and no claim contradicts its evidence.
function completedLabel(analysis: Pick<Analysis, "kind" | "result" | "editedResult" | "evidenceIssues">) {
  if ((analysis.evidenceIssues ?? []).some(isBlockingIssue)) return "Provisional";
  const draft = storedDraft(analysis);
  if (!draft) return "Ready";
  const { openQuestions, needsClarification } = draftReadiness(draft);
  return openQuestions || needsClarification ? "Provisional" : "Ready";
}

export function AnalysisStatusBadge({
  analysis,
}: {
  analysis: Pick<Analysis, "status" | "publishedIssueKey" | "kind" | "result" | "editedResult" | "evidenceIssues">;
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
      const label = completedLabel(analysis);
      return <Badge variant={label === "Ready" ? "outline" : "warning"}>{label}</Badge>;
    }
  }
}
