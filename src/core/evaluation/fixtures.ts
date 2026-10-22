import { z } from "zod";

export const evaluationCaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  expected: z.object({
    relevantFiles: z.array(z.string().min(1)).min(1),
    verifiedFacts: z.array(z.string().min(1)).min(1),
    mustStayUncertain: z.array(z.string().min(1)).min(1),
    forbiddenClaims: z.array(z.string().min(1)).min(1),
  }),
});
export type EvaluationCase = z.infer<typeof evaluationCaseSchema>;
