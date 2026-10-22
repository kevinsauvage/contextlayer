import type { TicketDraft } from "@/core/requirements/schemas";

export type EvidenceIssue = { path: string; message: string };

/**
 * Checks what schema validation cannot: that every evidence reference resolves and
 * that `verified` claims actually cite evidence. Structure is not truth.
 */
export function validateEvidenceReferences(draft: TicketDraft): EvidenceIssue[] {
  const issues: EvidenceIssue[] = [];
  const known = new Set<string>();

  draft.evidence.forEach((item, i) => {
    if (known.has(item.id)) issues.push({ path: `evidence[${i}].id`, message: `duplicate evidence id "${item.id}"` });
    known.add(item.id);
  });

  const check = (section: string, claims: TicketDraft["description"]) =>
    claims.forEach((claim, i) => {
      const path = `${section}[${i}]`;
      for (const id of claim.evidenceIds) {
        if (!known.has(id)) issues.push({ path, message: `unknown evidence id "${id}"` });
      }
      if (claim.status === "verified" && claim.evidenceIds.length === 0) {
        issues.push({ path, message: "verified claim has no evidence" });
      }
    });

  check("description", draft.description);
  check("acceptanceCriteria", draft.acceptanceCriteria);
  return issues;
}
