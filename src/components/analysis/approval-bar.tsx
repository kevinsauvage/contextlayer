"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { countLabel } from "@/lib/count";

type Props = {
  publishLabel: string;
  trackerName: string;
  // "Creates a new issue in SHOP" or "Updates SHOP-12".
  target: string;
  labelled: number;
  // Reasons the draft is not settled; publishing anyway is offered for all but the blocking ones.
  unresolved: string[];
  unappliedAnswers: number;
  // Claims whose evidence does not support them: approval is disabled until they are fixed.
  blocking: number;
  pending: boolean;
  updating: boolean;
  onApprove: () => void;
};

// The approval bar: the state of the draft, the Approve button, and the confirmation for unresolved but publishable items.
export function ApprovalBar({
  publishLabel,
  trackerName,
  target,
  labelled,
  unresolved,
  unappliedAnswers,
  blocking,
  pending,
  updating,
  onApprove,
}: Props) {
  const [confirming, setConfirming] = useState(false);

  const approve = () => {
    setConfirming(false);
    onApprove();
  };

  return (
    <div
      className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur"
      aria-label="Approval"
      role="region"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5 text-sm">
          {unresolved.length ? (
            <p className="flex items-center gap-1.5 font-medium">
              <CircleAlert aria-hidden className="size-4 shrink-0 text-warning" />
              {unresolved.join(" · ")}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 font-medium">
              <CircleCheck aria-hidden className="size-4 shrink-0 text-success" />
              Nothing left to decide
            </p>
          )}
          <p className="text-muted-foreground">
            {target}
            {labelled > 0 && ` with ${countLabel(labelled, "labelled claim", "labelled claims")}`}. Nothing is sent to{" "}
            {trackerName} until you approve.
          </p>
        </div>
        {!confirming && (
          <Button
            disabled={pending || updating || blocking > 0}
            title={
              blocking
                ? "Fix the claims that do not match their evidence first"
                : updating
                  ? "The draft is being redrafted"
                  : undefined
            }
            onClick={() => (unresolved.length ? setConfirming(true) : approve())}
          >
            {pending ? "Publishing…" : updating ? "Waiting for the draft…" : publishLabel}
          </Button>
        )}
      </div>
      {confirming && (
        <div role="alert" className="flex flex-col gap-2 rounded-lg bg-warning/10 p-3 text-sm">
          <p>
            <span className="font-medium">Still unresolved: {unresolved.join(" · ")}.</span> Open questions and claims
            that need clarification are published labelled in {trackerName}.
            {unappliedAnswers > 0 && " Answers you have not applied are not included."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={approve}>
              Publish anyway
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(false)}>
              Keep editing
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
