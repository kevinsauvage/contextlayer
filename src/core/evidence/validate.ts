import type { Claim, Evidence } from "./schemas";

export type EvidenceIssue = { path: string; message: string };

export type ClaimSections = Record<string, Claim[]>;

const SECTION_ITEM_LABELS: Record<string, string> = {
  description: "Description paragraph",
  acceptanceCriteria: "Acceptance criterion",
  findings: "Finding",
};

const itemLabel = (section: string, index: number) => `${SECTION_ITEM_LABELS[section] ?? section} ${index + 1}`;

// Schema validation checks structure only; this checks that cited evidence exists.
export function validateEvidenceReferences(evidence: Evidence[], sections: ClaimSections): EvidenceIssue[] {
  const issues: EvidenceIssue[] = [];
  const known = new Set<string>();

  evidence.forEach((item, i) => {
    if (known.has(item.id)) issues.push({ path: `evidence[${i}].id`, message: `Evidence ${item.id} is listed twice.` });
    known.add(item.id);
  });

  for (const [section, claims] of Object.entries(sections)) {
    claims.forEach((claim, i) => {
      const path = `${section}[${i}]`;
      const label = itemLabel(section, i);
      for (const id of claim.evidenceIds) {
        if (!known.has(id))
          issues.push({ path, message: `${label} cites evidence ${id}, which is not in the evidence list.` });
      }
      if (claim.status === "verified" && claim.evidenceIds.length === 0) {
        issues.push({ path, message: `${label} is marked Verified but cites no evidence.` });
      }
    });
  }
  return issues;
}
