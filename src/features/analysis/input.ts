import type { AuditAnalysisInput, CreateAnalysisInput, StoredAnalysisInput } from "@/core/analysis/schemas";
import { storedAnalysisInputSchema } from "@/core/analysis/schemas";
import { isFollowUp, type Clarification, type Refinement } from "@/core/requirements/schemas";
import type { Analysis } from "@/features/projects/queries";

// The stored input tagged with the row's kind, so callers narrow instead of guessing which fields exist.
export type AnalysisInput = ({ kind: "create" } & CreateAnalysisInput) | ({ kind: "audit" } & AuditAnalysisInput);

const storedInput = (analysis: Pick<Analysis, "kind" | "input">): StoredAnalysisInput | null =>
  storedAnalysisInputSchema.safeParse(analysis.input).data ?? null;

export function readAnalysisInput(analysis: Pick<Analysis, "kind" | "input">): AnalysisInput | null {
  const stored = storedInput(analysis);
  if (!stored) return null;
  if (analysis.kind === "audit") return "issueKey" in stored ? { kind: "audit", ...stored } : null;
  return "request" in stored ? { kind: "create", ...stored, answers: stored.answers ?? [] } : null;
}

// What the user asked for, whether that is a request or an audited issue key.
export const requestOf = (input: AnalysisInput | null) =>
  !input ? "" : input.kind === "create" ? input.request : input.issueKey;

export const answersOf = (input: AnalysisInput | null): Refinement[] =>
  input?.kind === "create" ? (input.answers ?? []) : [];

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
