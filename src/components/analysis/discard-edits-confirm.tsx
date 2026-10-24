"use client";

import { useRefinement } from "@/components/analysis/refinement-context";
import { Button } from "@/components/ui/button";

export function DiscardEditsConfirm({ origin, action }: { origin: "chat" | "questions"; action: string }) {
  const { confirmingFor, confirmDiscard, cancelDiscard } = useRefinement();
  if (!confirmingFor(origin)) return null;
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-lg bg-warning/10 p-3 text-sm">
      <p>
        <span className="font-medium">You edited the draft.</span> Redrafting replaces it, so your edits will be lost.
        Copy anything you want to keep first.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="destructive" onClick={confirmDiscard}>
          Discard edits and {action}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={cancelDiscard}>
          Keep my edits
        </Button>
      </div>
    </div>
  );
}
