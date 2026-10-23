import { z } from "zod";
import { clarificationSchema } from "@/core/requirements/schemas";

const createAnalysisInputSchema = z.object({
  request: z.string().min(1),
  answers: z.array(clarificationSchema).optional(),
});

const auditAnalysisInputSchema = z.object({ issueKey: z.string().min(1) });

// Rows written before 2026-10-23 stored the request as `title`.
const legacyAnalysisInputSchema = z.object({ title: z.string().min(1) });

// What `analysis.input` holds. The row's `kind` column picks the variant, so the JSON does not repeat it.
export const storedAnalysisInputSchema = z.union([
  createAnalysisInputSchema,
  auditAnalysisInputSchema,
  legacyAnalysisInputSchema,
]);
export type StoredAnalysisInput = z.infer<typeof storedAnalysisInputSchema>;
