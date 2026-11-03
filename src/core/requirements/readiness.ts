import type { TicketDraft } from "./schemas";

export type DraftReadiness = {
  openQuestions: number;
  // Claims whose status is `needs_clarification`: undecided, but not a question.
  needsClarification: number;
  labelled: number;
};

// One reading of a draft's state, shared by the approval bar, the provisional notice and the history badge.
export function draftReadiness(
  draft: Pick<TicketDraft, "description" | "acceptanceCriteria" | "openQuestions">,
): DraftReadiness {
  const claims = [...draft.description, ...draft.acceptanceCriteria];
  const withStatus = (status: string) => claims.filter((claim) => claim.status === status).length;
  return {
    openQuestions: draft.openQuestions.length,
    needsClarification: withStatus("needs_clarification"),
    labelled: withStatus("inferred") + withStatus("unknown"),
  };
}
