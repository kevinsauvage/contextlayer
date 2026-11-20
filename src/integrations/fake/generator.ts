import "server-only";
import type { AuditGenerator, DraftGenerator, EvidenceSelector } from "@/core/analysis/generators";
import type { Evidence } from "@/core/evidence/schemas";
import type { DraftBody } from "@/core/requirements/schemas";

// Test-only stand-ins for the model, enabled by E2E_FAKE_PROVIDERS: answers are built from the request and the real
// candidates, so the pipeline (retrieval, citation, validation, publishing) runs for real around them.

const TITLE_CHARS = 80;

// Markers a browser test can put in a request or a chat message to reach a state the canned draft never reaches.
const QUESTION_MARKER = "[[question]]";
const FAIL_ONCE_MARKER = "[[fail-once]]";

const firstLine = (text: string) => text.trim().split("\n", 1)[0]?.trim() ?? "";

const questionsFor = (request: string): DraftBody["openQuestions"] =>
  request.includes(QUESTION_MARKER)
    ? [
        {
          question: "Which rounding should the export use?",
          impact: "Changes every total in the file.",
          options: [
            { text: "Half up", recommended: true },
            { text: "Half even", recommended: false },
          ],
          recommendation: "Half up matches the invoices already sent.",
        },
      ]
    : [];

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
    openQuestions: questionsFor(request),
  };
};

// A run marked for failure fails once, so Retry (which re-sends the same input) succeeds.
type AnswerLike = { message: string } | { question: string; answer: string };
const failedRuns = new Set<string>();

const messagesOf = (answers: readonly AnswerLike[]) =>
  answers.flatMap((answer) => ("message" in answer ? [answer.message] : []));

const shouldFailOnce = (request: string, answers: readonly AnswerLike[]) => {
  const texts = [request, ...messagesOf(answers)];
  if (!texts.some((text) => text.includes(FAIL_ONCE_MARKER))) return false;
  const key = `${request}\n${messagesOf(answers).join("\n")}`;
  if (failedRuns.has(key)) return false;
  failedRuns.add(key);
  return true;
};

export const cannedGenerator: DraftGenerator & AuditGenerator = {
  generate: ({ request, answers, candidates }) =>
    shouldFailOnce(request, answers)
      ? Promise.reject(new Error("The canned generator was asked to fail once."))
      : Promise.resolve({ body: cannedDraft(request, candidates) }),
  audit: ({ issue, candidates }) =>
    Promise.resolve({
      body: { summary: "Sample audit.", findings: [], proposedTicket: cannedDraft(issue.summary, candidates) },
    }),
};

export const firstFilesSelector: EvidenceSelector = {
  select: async ({ source }) => ({ paths: (await source.listFiles()).slice(0, 2) }),
};
