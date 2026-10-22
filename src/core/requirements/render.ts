import type { Claim } from "@/core/evidence/schemas";
import type { TicketDraft } from "./schemas";

export type Bullet = string | { text: string; url: string };
export type TicketSection = { heading?: string; paragraphs?: string[]; bullets?: Bullet[] };

const STATUS_LABEL: Partial<Record<Claim["status"], string>> = {
  inferred: "Inferred",
  unknown: "Unknown",
  needs_clarification: "Needs clarification",
};

const labelled = (claim: Claim) => {
  const label = STATUS_LABEL[claim.status];
  return label ? `${label}: ${claim.text}` : claim.text;
};

export function ticketSections(draft: TicketDraft): TicketSection[] {
  const sections: TicketSection[] = [{ paragraphs: draft.description.map(labelled) }];
  if (draft.acceptanceCriteria.length) {
    sections.push({
      heading: "Acceptance criteria",
      bullets: draft.acceptanceCriteria.map((c) => (c.requiresProductDecision ? `${labelled(c)} (needs product decision)` : labelled(c))),
    });
  }
  if (draft.evidence.length) {
    sections.push({
      heading: "Relevant context",
      bullets: draft.evidence.map((e) => {
        const text = `${e.reference}${e.lines ? `:${e.lines.start}-${e.lines.end}` : ""}`;
        return e.url ? { text, url: e.url } : text;
      }),
    });
  }
  if (draft.assumptions.length) {
    sections.push({ heading: "Unverified assumptions", bullets: draft.assumptions.map((a) => `${a.text} (${a.rationale})`) });
  }
  if (draft.openQuestions.length) {
    sections.push({ heading: "Open questions", bullets: draft.openQuestions.map((q) => `${q.question} — ${q.impact}`) });
  }
  return sections;
}
