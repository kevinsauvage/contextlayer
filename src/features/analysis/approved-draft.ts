import type { Evidence } from "@/core/evidence/schemas";
import { withCitedEvidence, validateEvidenceReferences } from "@/core/evidence/validate";
import { draftSections, editedDraftSchema, type TicketDraft } from "@/core/requirements/schemas";
import { firstIssueMessage } from "@/lib/zod";

// The browser may edit claim text, status, citations and the other fields; it never supplies evidence itself.
// The list is rebuilt from the stored result, so a forged excerpt or URL cannot reach the tracker.
export function parseApprovedDraft(
  input: unknown,
  evidence: Evidence[],
  invalidMessage: string,
): { draft: TicketDraft } | { error: string } {
  const parsed = editedDraftSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error, invalidMessage) };
  const [issue] = validateEvidenceReferences(evidence, draftSections(parsed.data));
  if (issue) return { error: `${issue.message} Fix it in Edit, then approve again.` };
  return { draft: withCitedEvidence(parsed.data, evidence) };
}
