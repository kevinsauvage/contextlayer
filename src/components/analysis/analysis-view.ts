import type { Analysis } from "@/features/projects/queries";

export type AnalysisViewProps = { analysis: Analysis; trackerName: string; trackerKey: string };

export const publishedOf = (analysis: Analysis) => ({
  key: analysis.publishedIssueKey,
  url: analysis.publishedIssueUrl,
});
