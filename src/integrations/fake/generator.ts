import "server-only";
import type { AuditGenerator, DraftGenerator, EvidenceSelector } from "@/core/analysis/generators";
import type { Evidence } from "@/core/evidence/schemas";
import type { DraftBody } from "@/core/requirements/schemas";

// Test-only stand-ins for the model, enabled by E2E_FAKE_PROVIDERS: answers are built from the request and the real
// candidates, so the pipeline (retrieval, citation, validation, publishing) runs for real around them.

const TITLE_CHARS = 80;

const firstLine = (text: string) => text.trim().split("\n", 1)[0]?.trim() ?? "";

const cannedDraft = (request: string, candidates: Evidence[]): DraftBody => {
  const [source] = candidates;
  return {
    title: firstLine(request).slice(0, TITLE_CHARS) || "Sample ticket",
    description: [
      source
        ? { text: `The change concerns \`${source.reference}\`.`, status: "verified", evidenceIds: [source.id] }
        : { text: "No source matches the request.", status: "needs_clarification", evidenceIds: [] },
    ],
    acceptanceCriteria: [
      { text: "The requested change is visible.", status: "inferred", evidenceIds: [], requiresProductDecision: false },
    ],
    assumptions: [],
    openQuestions: [],
  };
};

export const cannedGenerator: DraftGenerator & AuditGenerator = {
  generate: ({ request, candidates }) => Promise.resolve({ body: cannedDraft(request, candidates) }),
  audit: ({ issue, candidates }) =>
    Promise.resolve({
      body: { summary: "Sample audit.", findings: [], proposedTicket: cannedDraft(issue.summary, candidates) },
    }),
};

export const firstFilesSelector: EvidenceSelector = {
  select: async ({ source }) => ({ paths: (await source.listFiles()).slice(0, 2) }),
};
