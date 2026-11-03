"use client";

import { useEffect, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { withoutIncompleteItems, type TicketDraft } from "@/core/requirements/schemas";
import type { ActionState } from "@/lib/action-state";

export type SaveStatus = { saved: boolean; error?: string };

const AUTOSAVE_DELAY_MS = 800;

// Persists edits once typing pauses. An audit passes no `save`, and a published or unedited draft never calls the server.
export function useAutosave(
  draft: TicketDraft,
  save: ((draft: TicketDraft) => Promise<ActionState>) | undefined,
  edited: boolean,
): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>({ saved: false });

  const persist = useDebouncedCallback((current: TicketDraft) => {
    void save?.(withoutIncompleteItems(current)).then(
      (outcome) => setStatus({ saved: !outcome.error, error: outcome.error }),
      () => setStatus({ saved: false, error: "Could not reach the server" }),
    );
  }, AUTOSAVE_DELAY_MS);

  // `persist` always calls the latest `save`; depending on `save` itself would save again whenever a parent re-renders
  // with a new bound action.
  const canSave = Boolean(save);
  useEffect(() => {
    if (!edited || !canSave) {
      persist.cancel();
      return;
    }
    persist(draft);
    return () => persist.cancel();
  }, [draft, edited, canSave, persist]);

  return status;
}
