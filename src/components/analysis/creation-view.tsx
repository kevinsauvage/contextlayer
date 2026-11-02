import { publishedOf, type AnalysisViewProps } from "@/components/analysis/analysis-view";
import { DraftWorkspace } from "@/components/analysis/draft-workspace";
import { OutdatedResult } from "@/components/analysis/outdated-result";
import type { EvidenceIssue } from "@/core/evidence/validate";
import type { TicketDraft } from "@/core/requirements/schemas";
import { storedEvidence } from "@/features/analysis/read";
import { publishTicket, saveDraftEdits } from "@/features/ticket-creation/actions";

type Props = AnalysisViewProps & { draft: TicketDraft | null; questionsAnchored: boolean; issues: EvidenceIssue[] };

export function CreationView({ analysis, draft, trackerName, trackerKey, questionsAnchored, issues }: Props) {
  if (!draft) return <OutdatedResult subject="draft" action="Send a message in the conversation to run it again." />;
  return (
    <DraftWorkspace
      key={analysis.startedAt.toISOString()}
      initial={draft}
      publish={publishTicket.bind(null, analysis.id)}
      save={saveDraftEdits.bind(null, analysis.id, analysis.runToken ?? "")}
      publishLabel={`Approve & create in ${trackerName}`}
      trackerName={trackerName}
      projectLabel={trackerKey}
      published={publishedOf(analysis)}
      questionsAnchored={questionsAnchored}
      issues={issues}
      evidence={storedEvidence(analysis)}
      projectId={analysis.projectId}
    />
  );
}
