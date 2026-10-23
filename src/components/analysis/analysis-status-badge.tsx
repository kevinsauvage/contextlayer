import { LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Analysis } from "@/features/projects/queries";

export function AnalysisStatusBadge({ analysis }: { analysis: Pick<Analysis, "status" | "publishedIssueKey"> }) {
  if (analysis.publishedIssueKey) return <Badge>{analysis.publishedIssueKey}</Badge>;
  switch (analysis.status) {
    case "running":
      return (
        <Badge variant="secondary">
          <LoaderCircle className="animate-spin" /> Running
        </Badge>
      );
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "completed":
      return <Badge variant="outline">Draft</Badge>;
  }
}
