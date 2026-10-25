import { publishedOf, type AnalysisViewProps } from "@/components/analysis/analysis-view";
import { DraftWorkspace } from "@/components/analysis/draft-workspace";
import { OutdatedResult } from "@/components/analysis/outdated-result";
import type { TicketDraft } from "@/core/requirements/schemas";
import { publishTicket, saveDraftEdits } from "@/features/ticket-creation/actions";

type Props = AnalysisViewProps & { draft: TicketDraft | null; questionsAnchored: boolean };

export function CreationView({ analysis, draft, trackerName, trackerKey, questionsAnchored }: Props) {
  if (!draft) return <OutdatedResult subject="draft" action="Send a message in the conversation to run it again." />;
  return (
    <DraftWorkspace
      key={analysis.startedAt.toISOString()}
      initial={draft}
      publish={publishTicket.bind(null, analysis.id)}
      save={saveDraftEdits.bind(null, analysis.id)}
      publishLabel={`Approve & create in ${trackerName}`}
      trackerName={trackerName}
      projectLabel={trackerKey}
      published={publishedOf(analysis)}
      questionsAnchored={questionsAnchored}
      projectId={analysis.projectId}
    />
  );
}
