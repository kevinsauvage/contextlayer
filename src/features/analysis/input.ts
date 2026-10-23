import { z } from "zod";

const inputSchema = z.object({
  request: z.string().optional(),
  title: z.string().optional(),
  issueKey: z.string().optional(),
});

// What the user asked for: the request text, or the audited issue key. Rows from before 2026-10-23 store it as `title`.
export function analysisRequest(input: unknown): string {
  const parsed = inputSchema.safeParse(input);
  return parsed.success ? (parsed.data.request ?? parsed.data.title ?? parsed.data.issueKey ?? "") : "";
}

export const firstLine = (text: string) =>
  text
    .split("\n")
    .find((line) => line.trim())
    ?.trim() ?? "";
