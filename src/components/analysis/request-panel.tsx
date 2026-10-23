import { ActionForm } from "@/components/action-form";
import { answersOf, requestOf, type AnalysisInput } from "@/features/analysis/input";
import type { Analysis } from "@/features/projects/queries";
import { rerunTicketAnalysis } from "@/features/ticket-creation/actions";

type Props = {
  analysis: Analysis;
  input: AnalysisInput | null;
  trackerName: string;
  editable: boolean;
};

export function RequestPanel({ analysis, input, trackerName, editable }: Props) {
  const request = requestOf(input);
  const answered = answersOf(input).filter((pair) => pair.answer);
  return (
    <section
      className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 text-sm"
      aria-labelledby="request-heading"
    >
      <h2 id="request-heading" className="text-xs font-medium text-muted-foreground">
        Your request
      </h2>
      <p className="whitespace-pre-wrap">{request}</p>
      {answered.length > 0 && (
        <dl className="flex flex-col gap-2 border-t pt-3">
          {answered.map((pair) => (
            <div key={pair.question}>
              <dt className="text-muted-foreground">{pair.question}</dt>
              <dd className="whitespace-pre-wrap">{pair.answer}</dd>
            </div>
          ))}
        </dl>
      )}
      {editable && (
        <details className="group" open={analysis.status === "failed"}>
          <summary className="cursor-pointer text-sm font-medium text-primary">Edit request</summary>
          <div className="mt-3">
            <ActionForm
              key={analysis.createdAt.toISOString()}
              action={rerunTicketAnalysis.bind(null, analysis.id)}
              name="request"
              title="Edit the request"
              description={`Add or change detail and run it again. Your answers are kept. This replaces the draft; nothing is sent to ${trackerName} until you approve.`}
              placeholder="Describe what should change, where, and why"
              defaultValue={request}
              multiline
              submitLabel="Run again"
              pendingLabel="Investigating…"
            />
          </div>
        </details>
      )}
    </section>
  );
}
