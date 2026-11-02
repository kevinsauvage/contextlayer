"use client";

import { RotateCcw } from "lucide-react";
import { TicketPreview } from "@/components/analysis/ticket-preview";
import { FormError } from "@/components/form-error";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/components/use-mutation";
import type { TicketDraft } from "@/core/requirements/schemas";
import type { ActionState } from "@/lib/action-state";

type Props = {
  draft: TicketDraft;
  trackerName: string;
  projectLabel: string;
  error: string | null;
  retry: () => Promise<ActionState>;
};

// A failed redraft leaves the last good draft on screen: it is readable, but only a completed run may be approved.
export function FailedDraft({ draft, trackerName, projectLabel, error, retry }: Props) {
  const { run, pending, error: actionError } = useMutation({ refresh: true });
  return (
    <div className="flex flex-col gap-4">
      <Alert variant="destructive">
        <AlertTitle>The redraft failed</AlertTitle>
        <AlertDescription>
          <p>{error ?? "The analysis failed."}</p>
          <p>This is the previous draft; it cannot be approved until a run succeeds.</p>
          <div className="mt-3 flex flex-col gap-2">
            <Button type="button" onClick={() => run(retry)} disabled={pending}>
              <RotateCcw aria-hidden />
              {pending ? "Retrying…" : "Retry"}
            </Button>
            <FormError error={actionError} />
          </div>
        </AlertDescription>
      </Alert>
      <TicketPreview
        draft={draft}
        trackerName={trackerName}
        projectLabel={projectLabel}
        issueKey={null}
        statusLabel="Previous draft"
        questionsAnchored={false}
      />
    </div>
  );
}
