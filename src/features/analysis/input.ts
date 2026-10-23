import { z } from "zod";
import { clarificationSchema, type Clarification } from "@/core/requirements/schemas";

const inputSchema = z.object({
  request: z.string().optional(),
  title: z.string().optional(),
  issueKey: z.string().optional(),
  answers: z.array(clarificationSchema).optional(),
});

// What the user asked for: the request text, or the audited issue key. Rows from before 2026-10-23 store it as `title`.
export function analysisRequest(input: unknown): string {
  const parsed = inputSchema.safeParse(input);
  return parsed.success ? (parsed.data.request ?? parsed.data.title ?? parsed.data.issueKey ?? "") : "";
}

export const analysisAnswers = (input: unknown): Clarification[] => inputSchema.safeParse(input).data?.answers ?? [];

// Earlier answers are kept; this round's questions replace the earlier unanswered ones, and a re-answered question
// takes its latest answer.
export function mergeAnswers(previous: Clarification[], round: Clarification[]): Clarification[] {
  const asked = new Set(round.map((pair) => pair.question));
  return [...previous.filter((pair) => pair.answer && !asked.has(pair.question)), ...round];
}

export const firstLine = (text: string) =>
  text
    .split("\n")
    .find((line) => line.trim())
    ?.trim() ?? "";
