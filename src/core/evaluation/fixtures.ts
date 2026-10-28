import { z } from "zod";
import { refinementSchema } from "@/core/requirements/schemas";

const issueSchema = z.object({
  key: z.string().min(1),
  summary: z.string(),
  description: z.string(),
  status: z.string(),
  url: z.string().min(1),
});

// A checkout read at a pinned commit, for a fixture too large to copy into the repository. `root` is relative to
// the case directory, and the commit keeps every run reading the same tree.
const repositorySchema = z.object({
  root: z.string().min(1),
  commit: z.string().regex(/^[0-9a-f]{7,40}$/, "a commit sha"),
});

const expectedSchema = z.object({
  relevantFiles: z.array(z.string().min(1)).min(1),
  verifiedFacts: z.array(z.string().min(1)).default([]),
  mustStayUncertain: z.array(z.string().min(1)).default([]),
  forbiddenClaims: z.array(z.string().min(1)).default([]),
  // Substrings a good draft must carry once the matching answer is applied (clarification cases only).
  appliedAnswers: z.array(z.string().min(1)).default([]),
});

export const evaluationCaseSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(["create", "audit", "retrieval"]).default("create"),
    title: z.string().min(1),
    // The full request when it is longer than its one-line title; `title` stays the short label.
    request: z.string().min(1).optional(),
    // The issue to audit, for `kind: "audit"`.
    issue: issueSchema.optional(),
    // Issues the tracker already holds, so retrieval can find a duplicate or related ticket.
    relatedIssues: z.array(issueSchema).default([]),
    // Answers and follow-ups from an earlier round, replayed against the fixture.
    answers: z.array(refinementSchema).default([]),
    repository: repositorySchema.optional(),
    tags: z.array(z.string().min(1)).default([]),
    expected: expectedSchema,
  })
  .superRefine((fixture, ctx) => {
    if (fixture.kind === "audit" && !fixture.issue) {
      ctx.addIssue({ code: "custom", message: "an audit case needs the issue to audit", path: ["issue"] });
    }
    // A retrieval case never reaches the judge, so the criteria would be invented rather than scoreable. It reads
    // either a copied `repo/` directory or a pinned checkout (`repository`).
    if (fixture.kind === "retrieval") return;
    for (const field of ["verifiedFacts", "mustStayUncertain", "forbiddenClaims"] as const) {
      if (fixture.expected[field].length === 0) {
        ctx.addIssue({ code: "custom", message: `a ${fixture.kind} case lists ${field}`, path: ["expected", field] });
      }
    }
  });

export type EvaluationCase = z.infer<typeof evaluationCaseSchema>;
