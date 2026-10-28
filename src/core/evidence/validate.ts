import { draftSections, type TicketDraft } from "@/core/requirements/schemas";
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

const BACKTICKED = /`([^`\n]+)`/g;
const DOUBLE_QUOTED = /"([^"\n]+)"|“([^”\n]+)”/g;

const normalize = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();

// Identifiers and quoted strings in a claim are literal claims about the code.
function quotedTokens(text: string): string[] {
  const quoted = [...text.matchAll(DOUBLE_QUOTED)].map(([, straight = "", curly = ""]) => straight || curly);
  return [...text.matchAll(BACKTICKED)]
    .map(([, token = ""]) => token)
    .concat(quoted)
    .map(normalize)
    .filter(Boolean);
}

// A bare tag (`<p>`) names the element; the source carries it with attributes or children, so the tag has to be
// there, not a byte-identical opening tag.
const BARE_TAG = /^<\/?([a-z][a-z0-9-]*)>$/;
const SELECTOR = /^#([a-z][\w-]*)$/i;
const PATH = /^[a-z0-9_$-]+(?:\.[a-z0-9_$-]+)+$/i;

const pathMatches = (source: string, path: string) => path.split(".").every((part) => source.includes(part));

// The claim may name the source's own notation rather than repeat it: a selector for an id, a dotted path for a
// nested value, or that path with its value appended. Paraphrases still fail, which is the point of the check.
const contains = (source: string, token: string) => {
  if (source.includes(token)) return true;
  const tag = BARE_TAG.exec(token)?.[1];
  if (tag) return new RegExp(`<${tag}(?=[\\s/>])`).test(source) || source.includes(`</${tag}>`);
  const id = SELECTOR.exec(token)?.[1];
  if (id) return source.includes(`id="${id}"`) || source.includes(`id='${id}'`);
  const [path = ""] = token.split(": ");
  return PATH.test(path) && pathMatches(source, path);
};

// A verified claim that quotes something no cited source contains cannot be verified by those sources.
function unsupportedQuotes(claim: Claim, evidence: Map<string, Evidence>): string[] {
  const sources = claim.evidenceIds.flatMap((id) => {
    const item = evidence.get(id);
    return item ? [normalize(`${item.reference}\n${item.excerpt}`)] : [];
  });
  if (!sources.length) return [];
  return quotedTokens(claim.text).filter((token) => !sources.some((source) => contains(source, token)));
}

// Schema validation checks structure only; this checks that cited evidence exists and supports what is quoted.
export function validateEvidenceReferences(evidence: Evidence[], sections: ClaimSections): EvidenceIssue[] {
  const issues: EvidenceIssue[] = [];
  const known = new Set<string>();
  const byId = new Map(evidence.map((item) => [item.id, item]));

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
      if (claim.status === "verified") {
        for (const token of unsupportedQuotes(claim, byId)) {
          issues.push({
            path,
            message: `${label} is marked Verified but quotes "${token}", which its cited evidence does not contain.`,
          });
        }
      }
    });
  }
  return issues;
}

// A value an option offers is not settled while the question is open: a claim that states it has decided for the
// user. Only decisive tokens are compared — numbers, codes and quoted snippets — so ordinary words shared with the
// question do not produce a warning.
const DECISIVE_NUMBER = /\b\d{2,4}\b/g;
const DECISIVE_QUOTED = /`([^`\n]+)`|"([^"\n]+)"/g;

const decisiveTokens = (text: string): string[] => {
  const numbers = [...text.matchAll(DECISIVE_NUMBER)].map(([token]) => token);
  const quoted = [...text.matchAll(DECISIVE_QUOTED)].map(([, backticked = "", straight = ""]) =>
    (backticked || straight).trim(),
  );
  return [...new Set([...numbers, ...quoted].filter((token) => token.length > 1))];
};

export function validateOpenQuestions(draft: TicketDraft): EvidenceIssue[] {
  const open = draft.openQuestions
    .map((question, index) => ({
      index,
      tokens: (question.options ?? []).flatMap((option) => decisiveTokens(option.text)),
    }))
    .filter((question) => question.tokens.length > 0);
  if (!open.length) return [];

  const issues: EvidenceIssue[] = [];
  for (const [section, claims] of Object.entries(draftSections(draft))) {
    claims.forEach((claim, i) => {
      const text = claim.text.toLowerCase();
      for (const question of open) {
        const hit = question.tokens.find((token) => text.includes(token.toLowerCase()));
        if (hit)
          issues.push({
            path: `${section}[${i}]`,
            message: `${itemLabel(section, i)} states "${hit}", which open question ${question.index + 1} asks; leave it undecided until the question is answered.`,
          });
      }
    });
  }
  return issues;
}
