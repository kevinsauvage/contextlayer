import { publishedOf, type AnalysisViewProps } from "@/components/analysis/analysis-view";
import { ClarifyQuestions } from "@/components/analysis/clarify-questions";
import { DraftWorkspace } from "@/components/analysis/draft-workspace";
import { OutdatedResult } from "@/components/analysis/outdated-result";
import type { TicketDraft } from "@/core/requirements/schemas";
import { answerQuestions, publishTicket } from "@/features/ticket-creation/actions";

type Props = AnalysisViewProps & { draft: TicketDraft | null };

export function CreationView({ analysis, draft, trackerName, trackerKey }: Props) {
  if (!draft) return <OutdatedResult subject="draft" action="Use Edit request above to run it again." />;
  const runKey = analysis.createdAt.toISOString();
  return (
    <>
      {!analysis.publishedIssueKey && draft.openQuestions.length > 0 && (
        <ClarifyQuestions
          key={`questions-${runKey}`}
          questions={draft.openQuestions}
          trackerName={trackerName}
          answer={answerQuestions.bind(null, analysis.id)}
        />
      )}
      <DraftWorkspace
        key={runKey}
        initial={draft}
        publish={publishTicket.bind(null, analysis.id)}
        publishLabel={`Approve & create in ${trackerName}`}
        trackerName={trackerName}
        projectLabel={trackerKey}
        published={publishedOf(analysis)}
      />
    </>
  );
}
