import type { Claim, ClaimStatus } from "@/core/evidence/schemas";
import type { TicketDraft } from "./schemas";

// A line keeps its claim status separate so each renderer can label or badge it in its own way.
export type Bullet = {
  status?: ClaimStatus;
  text: string;
  url?: string;
  evidenceIds?: string[];
  evidenceId?: string;
  needsDecision?: boolean;
};
export type TicketSection = { heading?: string; paragraphs?: Bullet[]; bullets?: Bullet[]; openQuestions?: boolean };

export type Span = { text: string; code?: boolean };

// Drafts mark identifiers with backticks; renderers show those spans as inline code.
export function inlineSpans(text: string): Span[] {
  return text
    .split(/(`[^`\n]+`)/)
    .filter(Boolean)
    .map((part) => (/^`[^`\n]+`$/.test(part) ? { text: part.slice(1, -1), code: true } : { text: part }));
}

export const plainInline = (text: string) =>
  inlineSpans(text)
    .map((span) => span.text)
    .join("");

const claimBullet = (claim: Claim, text = claim.text): Bullet => ({
  status: claim.status,
  text,
  ...(claim.evidenceIds.length ? { evidenceIds: claim.evidenceIds } : {}),
});

export function ticketSections(draft: TicketDraft): TicketSection[] {
  const sections: TicketSection[] = [{ paragraphs: draft.description.map((claim) => claimBullet(claim)) }];
  if (draft.acceptanceCriteria.length) {
    sections.push({
      heading: "Acceptance criteria",
      bullets: draft.acceptanceCriteria.map((c) =>
        c.requiresProductDecision
          ? { ...claimBullet(c, `${c.text} (needs product decision)`), needsDecision: true }
          : claimBullet(c),
      ),
    });
  }
  if (draft.evidence.length) {
    sections.push({
      heading: "Relevant context",
      bullets: draft.evidence.map((e) => ({
        evidenceId: e.id,
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
      openQuestions: true,
      bullets: draft.openQuestions.map((q) => ({ text: `${q.question} — ${q.impact}` })),
    });
  }
  return sections;
}
