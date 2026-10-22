import type { Claim, Evidence } from "./schemas";

export type EvidenceIssue = { path: string; message: string };

export type ClaimSections = Record<string, Claim[]>;

// Schema validation checks structure only; this checks that cited evidence exists.
export function validateEvidenceReferences(evidence: Evidence[], sections: ClaimSections): EvidenceIssue[] {
  const issues: EvidenceIssue[] = [];
  const known = new Set<string>();

  evidence.forEach((item, i) => {
    if (known.has(item.id)) issues.push({ path: `evidence[${i}].id`, message: `duplicate evidence id "${item.id}"` });
    known.add(item.id);
  });

  for (const [section, claims] of Object.entries(sections)) {
    claims.forEach((claim, i) => {
      const path = `${section}[${i}]`;
      for (const id of claim.evidenceIds) {
        if (!known.has(id)) issues.push({ path, message: `unknown evidence id "${id}"` });
      }
      if (claim.status === "verified" && claim.evidenceIds.length === 0) {
        issues.push({ path, message: "verified claim has no evidence" });
      }
    });
  }
  return issues;
}
