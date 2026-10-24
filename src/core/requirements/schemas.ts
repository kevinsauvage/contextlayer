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

const answerOptionSchema = z.object({
  text: z.string().min(1).max(300).describe("A concrete answer the requester can pick."),
  recommended: z.boolean().default(false).describe("True for the option you recommend."),
});
export type AnswerOption = z.infer<typeof answerOptionSchema>;

const openQuestionSchema = z.object({
  question: z.string().min(1),
  impact: z.string().min(1).describe("How the answer changes scope or outcome."),
  options: z
    .array(answerOptionSchema)
    .max(4)
    .optional()
    .describe("Two to four concrete answers when the choice is discrete; omit when only free text fits."),
  recommendation: z
    .string()
    .min(1)
    .max(500)
    .optional()
    .describe("Why the recommended option is the best choice, in one sentence."),
});

export const draftBodySchema = z.object({
  title: z.string().min(1),
  description: z.array(claimSchema).min(1),
  acceptanceCriteria: z.array(acceptanceCriterionSchema),
  assumptions: z.array(assumptionSchema),
  openQuestions: z.array(openQuestionSchema),
});
export type DraftBody = z.infer<typeof draftBodySchema>;

// The requester's answer to a question from an earlier draft; an empty answer leaves the question open.
export const clarificationSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  answer: z.string().trim().max(4000),
});
export type Clarification = z.infer<typeof clarificationSchema>;

export const ticketDraftSchema = draftBodySchema.extend({ evidence: z.array(evidenceSchema) });
export type TicketDraft = z.infer<typeof ticketDraftSchema>;

export const draftSections = (draft: DraftBody) => ({
  description: draft.description,
  acceptanceCriteria: draft.acceptanceCriteria,
});
