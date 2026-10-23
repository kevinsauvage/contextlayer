import { z } from "zod";
import { claimSchema, evidenceSchema } from "@/core/evidence/schemas";

const acceptanceCriterionSchema = claimSchema.extend({
  requiresProductDecision: z
    .boolean()
    .default(false)
    .describe("True when the criterion encodes a product decision the context cannot establish."),
});

const assumptionSchema = z.object({
  text: z.string().min(1),
  rationale: z.string().min(1).describe("Why this seems reasonable but cannot be established from the context."),
});

const openQuestionSchema = z.object({
  question: z.string().min(1),
  impact: z.string().min(1).describe("How the answer changes scope or outcome."),
});

export const draftBodySchema = z.object({
  title: z.string().min(1),
  description: z.array(claimSchema).min(1),
  acceptanceCriteria: z.array(acceptanceCriterionSchema),
  assumptions: z.array(assumptionSchema),
  openQuestions: z.array(openQuestionSchema),
});
export type DraftBody = z.infer<typeof draftBodySchema>;

export const ticketDraftSchema = draftBodySchema.extend({ evidence: z.array(evidenceSchema) });
export type TicketDraft = z.infer<typeof ticketDraftSchema>;

export const draftSections = (draft: DraftBody) => ({
  description: draft.description,
  acceptanceCriteria: draft.acceptanceCriteria,
});
