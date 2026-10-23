import type { Claim, ClaimStatus } from "@/core/evidence/schemas";
import type { TicketDraft } from "./schemas";

// A line keeps its claim status separate so each renderer can label or badge it in its own way.
export type Bullet = { status?: ClaimStatus; text: string; url?: string };
export type TicketSection = { heading?: string; paragraphs?: Bullet[]; bullets?: Bullet[] };

const claimBullet = (claim: Claim): Bullet => ({ status: claim.status, text: claim.text });

export function ticketSections(draft: TicketDraft): TicketSection[] {
  const sections: TicketSection[] = [{ paragraphs: draft.description.map(claimBullet) }];
  if (draft.acceptanceCriteria.length) {
    sections.push({
      heading: "Acceptance criteria",
      bullets: draft.acceptanceCriteria.map((c) => ({
        status: c.status,
        text: c.requiresProductDecision ? `${c.text} (needs product decision)` : c.text,
      })),
    });
  }
  if (draft.evidence.length) {
    sections.push({
      heading: "Relevant context",
      bullets: draft.evidence.map((e) => ({
        text: `${e.reference}${e.lines ? `:${e.lines.start}-${e.lines.end}` : ""}`,
        ...(e.url ? { url: e.url } : {}),
      })),
    });
  }
  if (draft.assumptions.length) {
    sections.push({
      heading: "Unverified assumptions",
      bullets: draft.assumptions.map((a) => ({ text: `${a.text} (${a.rationale})` })),
    });
  }
  if (draft.openQuestions.length) {
    sections.push({
      heading: "Open questions",
      bullets: draft.openQuestions.map((q) => ({ text: `${q.question} — ${q.impact}` })),
    });
  }
  return sections;
}
