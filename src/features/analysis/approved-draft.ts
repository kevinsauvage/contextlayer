import { validateEvidenceReferences } from "@/core/evidence/validate";
import { draftSections, ticketDraftSchema, type TicketDraft } from "@/core/requirements/schemas";

export function parseApprovedDraft(input: unknown, invalidMessage: string): { draft: TicketDraft } | { error: string } {
  const parsed = ticketDraftSchema.safeParse(input);
  if (!parsed.success) return { error: invalidMessage };
  const [issue] = validateEvidenceReferences(parsed.data.evidence, draftSections(parsed.data));
  if (issue) return { error: `Evidence problem: ${issue.message}` };
  return { draft: parsed.data };
}
