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

// Jira rejects a summary over 255 characters or containing a line break, so the draft cannot hold one either.
const titleSchema = z
  .string()
  .transform((value) => value.replace(/[\r\n]+/g, " ").trim())
  .pipe(z.string().min(1, "Enter a title").max(255, "Keep the title under 255 characters"));

export const draftBodySchema = z.object({
  title: titleSchema,
  description: z.array(claimSchema).min(1),
  acceptanceCriteria: z.array(acceptanceCriterionSchema),
  assumptions: z.array(assumptionSchema),
  openQuestions: z.array(openQuestionSchema),
});
export type DraftBody = z.infer<typeof draftBodySchema>;

const MAX_EDITED_ITEMS = 100;
const MAX_EDITED_TEXT_CHARS = 4000;

// What the browser sends back after editing. The model's own draft is not bounded here: its size is the provider's
// output limit, while a hand-built request could otherwise store a body as large as the host accepts.
export const editedDraftSchema = draftBodySchema.superRefine((draft, context) => {
  const lists = [draft.description, draft.acceptanceCriteria, draft.assumptions, draft.openQuestions];
  if (lists.some((list) => list.length > MAX_EDITED_ITEMS))
    context.addIssue({ code: "custom", message: `Keep each section to ${MAX_EDITED_ITEMS} items` });
  const texts = [
    ...[...draft.description, ...draft.acceptanceCriteria].map((claim) => claim.text),
    ...draft.assumptions.flatMap((item) => [item.text, item.rationale]),
    ...draft.openQuestions.flatMap((item) => [item.question, item.impact]),
  ];
  if (texts.some((text) => text.length > MAX_EDITED_TEXT_CHARS))
    context.addIssue({ code: "custom", message: "Keep each entry under 4,000 characters" });
});

// The requester's answer to a question from an earlier draft; an empty answer leaves the question open.
export const clarificationSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  answer: z.string().trim().max(4000),
});
export type Clarification = z.infer<typeof clarificationSchema>;

// A chat message refining the draft outside any question.
const followUpSchema = z.object({ message: z.string().trim().min(1).max(4000) });
type FollowUp = z.infer<typeof followUpSchema>;

// Answers and follow-ups in the order the requester sent them.
export const refinementSchema = z.union([clarificationSchema, followUpSchema]);
export type Refinement = z.infer<typeof refinementSchema>;

export const isFollowUp = (refinement: Refinement): refinement is FollowUp => "message" in refinement;
export const refinementText = (refinement: Refinement) =>
  isFollowUp(refinement) ? refinement.message : refinement.answer;

export const MAX_REFINEMENTS = 30;
export const MAX_REFINEMENT_CHARS = 20_000;

const refinementLength = (refinement: Refinement) =>
  isFollowUp(refinement) ? refinement.message.length : refinement.question.length + refinement.answer.length;

// A long chat keeps the latest turns and drops the oldest: the fresh answer is what the next draft needs, and an
// injected or forged history cannot grow every later prompt without bound.
export function boundRefinements(refinements: Refinement[]): Refinement[] {
  const kept: Refinement[] = [];
  let characters = 0;
  for (let index = refinements.length - 1; index >= 0; index -= 1) {
    const refinement = refinements[index];
    if (!refinement) continue;
    const length = refinementLength(refinement);
    if (kept.length >= MAX_REFINEMENTS || characters + length > MAX_REFINEMENT_CHARS) break;
    kept.unshift(refinement);
    characters += length;
  }
  return kept;
}

export const ticketDraftSchema = draftBodySchema.extend({ evidence: z.array(evidenceSchema) });
export type TicketDraft = z.infer<typeof ticketDraftSchema>;

export const draftSections = (draft: DraftBody) => ({
  description: draft.description,
  acceptanceCriteria: draft.acceptanceCriteria,
});

// A new list item starts empty, which the schema rejects; autosave keeps only the finished items.
export const withoutIncompleteItems = (draft: TicketDraft): TicketDraft => ({
  ...draft,
  description: draft.description.filter((claim) => claim.text.trim()),
  acceptanceCriteria: draft.acceptanceCriteria.filter((claim) => claim.text.trim()),
  assumptions: draft.assumptions.filter((item) => item.text.trim() && item.rationale.trim()),
  openQuestions: draft.openQuestions.filter((item) => item.question.trim() && item.impact.trim()),
});
