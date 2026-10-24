import { z } from "zod";
import { refinementSchema } from "@/core/requirements/schemas";

const issueSchema = z.object({
  key: z.string().min(1),
  summary: z.string(),
  description: z.string(),
  status: z.string(),
  url: z.string().min(1),
});

const expectedSchema = z.object({
  relevantFiles: z.array(z.string().min(1)).min(1),
  verifiedFacts: z.array(z.string().min(1)).min(1),
  mustStayUncertain: z.array(z.string().min(1)).min(1),
  forbiddenClaims: z.array(z.string().min(1)).min(1),
  // Substrings a good draft must carry once the matching answer is applied (clarification cases only).
  appliedAnswers: z.array(z.string().min(1)).default([]),
});

export const evaluationCaseSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(["create", "audit"]).default("create"),
    title: z.string().min(1),
    // The full request when it is longer than its one-line title; `title` stays the short label.
    request: z.string().min(1).optional(),
    // The issue to audit, for `kind: "audit"`.
    issue: issueSchema.optional(),
    // Issues the tracker already holds, so retrieval can find a duplicate or related ticket.
    relatedIssues: z.array(issueSchema).default([]),
    // Answers and follow-ups from an earlier round, replayed against the fixture.
    answers: z.array(refinementSchema).default([]),
    tags: z.array(z.string().min(1)).default([]),
    expected: expectedSchema,
  })
  .superRefine((fixture, ctx) => {
    if (fixture.kind === "audit" && !fixture.issue) {
      ctx.addIssue({ code: "custom", message: "an audit case needs the issue to audit", path: ["issue"] });
    }
  });

export type EvaluationCase = z.infer<typeof evaluationCaseSchema>;
