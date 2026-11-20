import { LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isBlockingIssue } from "@/core/evidence/validate";
import { draftReadiness } from "@/core/requirements/readiness";
import { storedDraft } from "@/features/analysis/read";
import type { Analysis, AnalysisReadiness } from "@/features/projects/queries";

// A completed run is only ready once nothing is left to decide and no claim contradicts its evidence.
function completedLabel(
  analysis: Partial<Pick<Analysis, "kind" | "result" | "editedResult" | "evidenceIssues">>,
  readiness?: AnalysisReadiness,
) {
  if (readiness)
    return readiness.blocking || readiness.openQuestions || readiness.needsClarification ? "Provisional" : "Ready";
  if ((analysis.evidenceIssues ?? []).some(isBlockingIssue)) return "Provisional";
  if (analysis.kind && analysis.result !== undefined && analysis.editedResult !== undefined) {
    const draft = storedDraft({
      kind: analysis.kind,
      result: analysis.result,
      editedResult: analysis.editedResult,
    });
    if (!draft) return "Ready";
    const { openQuestions, needsClarification } = draftReadiness(draft);
    return openQuestions || needsClarification ? "Provisional" : "Ready";
  }
  return "Ready";
}

export function AnalysisStatusBadge({
  analysis,
  readiness,
}: {
  analysis: Pick<Analysis, "status" | "publishedIssueKey"> &
    Partial<Pick<Analysis, "kind" | "result" | "editedResult" | "evidenceIssues">>;
  // A precomputed verdict from the history query; without it the badge parses the stored draft.
  readiness?: AnalysisReadiness;
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
      const label = completedLabel(analysis, readiness);
      return <Badge variant={label === "Ready" ? "outline" : "warning"}>{label}</Badge>;
    }
  }
}
