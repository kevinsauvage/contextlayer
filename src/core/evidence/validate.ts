import type { Claim, Evidence } from "./schemas";

export type EvidenceIssue = { path: string; message: string };

export type ClaimSections = Record<string, Claim[]>;

const SECTION_ITEM_LABELS: Record<string, string> = {
  description: "Description paragraph",
  acceptanceCriteria: "Acceptance criterion",
  findings: "Finding",
};

const itemLabel = (section: string, index: number) => `${SECTION_ITEM_LABELS[section] ?? section} ${index + 1}`;

// Only the sources a claim actually cites are published, so a ticket never carries unused excerpts.
export function citedEvidence(evidence: Evidence[], sections: ClaimSections): Evidence[] {
  const ids = new Set(Object.values(sections).flatMap((claims) => claims.flatMap((claim) => claim.evidenceIds)));
  return evidence.filter((item) => ids.has(item.id));
}

const EVIDENCE_REQUIRED_CATEGORIES: Record<string, string> = {
  conflict_with_code: "a conflict with the code",
  existing_implementation_or_duplicate: "an existing implementation or duplicate",
};

// A conflict or a duplicate is a claim about the code that only evidence can settle, whatever the model's status.
export function validateAuditFindings(findings: (Claim & { category: string })[]): EvidenceIssue[] {
  return findings.flatMap((finding, i) => {
    const label = EVIDENCE_REQUIRED_CATEGORIES[finding.category];
    if (!label || finding.status === "verified") return [];
    return [
      {
        path: `findings[${i}]`,
        message: `${itemLabel("findings", i)} reports ${label} but is not Verified with evidence.`,
      },
    ];
  });
}

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
