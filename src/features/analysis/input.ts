import { storedAnalysisInputSchema } from "@/core/analysis/schemas";
import { isFollowUp, type Clarification, type Refinement } from "@/core/requirements/schemas";
import type { Analysis } from "@/features/projects/queries";

// The stored input tagged with the row's kind, so callers narrow instead of guessing which fields exist.
export type AnalysisInput =
  { kind: "create"; request: string; answers: Refinement[] } | { kind: "audit"; issueKey: string };

export function readAnalysisInput(analysis: Pick<Analysis, "kind" | "input">): AnalysisInput | null {
  const parsed = storedAnalysisInputSchema.safeParse(analysis.input);
  if (!parsed.success) return null;
  const stored = parsed.data;
  if (analysis.kind === "audit") return "issueKey" in stored ? { kind: "audit", issueKey: stored.issueKey } : null;
  if ("request" in stored) return { kind: "create", request: stored.request, answers: stored.answers ?? [] };
  return "title" in stored ? { kind: "create", request: stored.title, answers: [] } : null;
}

// What the user asked for, whether that is a request or an audited issue key.
export const requestOf = (input: AnalysisInput | null) =>
  !input ? "" : input.kind === "create" ? input.request : input.issueKey;

export const answersOf = (input: AnalysisInput | null): Refinement[] => (input?.kind === "create" ? input.answers : []);

// Earlier answers and follow-ups are kept; this round's questions replace the earlier unanswered ones, and a
// re-answered question takes its latest answer.
export function mergeAnswers(previous: Refinement[], round: Clarification[]): Refinement[] {
  const asked = new Set(round.map((pair) => pair.question));
  return [...previous.filter((r) => isFollowUp(r) || (r.answer && !asked.has(r.question))), ...round];
}

export const firstLine = (text: string) =>
  text
    .split("\n")
    .find((line) => line.trim())
    ?.trim() ?? "";
