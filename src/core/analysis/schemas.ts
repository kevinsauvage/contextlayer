import { z } from "zod";
import { boundRefinements, refinementSchema } from "@/core/requirements/schemas";

const createAnalysisInputSchema = z.object({
  request: z.string().min(1),
  // Stored inputs predate the cap, so trim on read instead of rejecting an old row.
  answers: z.array(refinementSchema).transform(boundRefinements).optional(),
});

const auditAnalysisInputSchema = z.object({ issueKey: z.string().min(1) });

// What `analysis.input` holds. The row's `kind` column picks the variant, so the JSON does not repeat it.
export const storedAnalysisInputSchema = z.union([createAnalysisInputSchema, auditAnalysisInputSchema]);
export type CreateAnalysisInput = z.infer<typeof createAnalysisInputSchema>;
export type AuditAnalysisInput = z.infer<typeof auditAnalysisInputSchema>;
export type StoredAnalysisInput = z.infer<typeof storedAnalysisInputSchema>;
