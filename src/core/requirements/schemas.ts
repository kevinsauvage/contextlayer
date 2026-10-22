import { z } from "zod";
import { claimSchema, evidenceSchema } from "@/core/evidence/schemas";

export const acceptanceCriterionSchema = claimSchema.extend({
  /** True when the criterion encodes a product decision the context cannot establish. */
  requiresProductDecision: z.boolean().default(false),
});
export type AcceptanceCriterion = z.infer<typeof acceptanceCriterionSchema>;

export const assumptionSchema = z.object({
  text: z.string().min(1),
  /** Why this seems reasonable but cannot be established from the available context. */
  rationale: z.string().min(1),
});
export type Assumption = z.infer<typeof assumptionSchema>;

export const openQuestionSchema = z.object({
  question: z.string().min(1),
  /** How the answer changes scope or outcome; questions without impact should not be asked. */
  impact: z.string().min(1),
});
export type OpenQuestion = z.infer<typeof openQuestionSchema>;

export const ticketDraftSchema = z.object({
  title: z.string().min(1),
  description: z.array(claimSchema).min(1),
  acceptanceCriteria: z.array(acceptanceCriterionSchema),
  evidence: z.array(evidenceSchema),
  assumptions: z.array(assumptionSchema),
  openQuestions: z.array(openQuestionSchema),
});
export type TicketDraft = z.infer<typeof ticketDraftSchema>;
