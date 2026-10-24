import { z } from "zod";

const claimStatusSchema = z
  .enum(["verified", "inferred", "unknown", "needs_clarification"])
  .describe(
    "verified: directly supported by cited evidence. inferred: reasonable but unconfirmed. unknown: context cannot establish it. needs_clarification: a human must decide.",
  );
export type ClaimStatus = z.infer<typeof claimStatusSchema>;

export const CLAIM_STATUSES = claimStatusSchema.options;

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  verified: "Verified",
  inferred: "Inferred",
  unknown: "Unknown",
  needs_clarification: "Needs clarification",
};

export const CLAIM_STATUS_DESCRIPTIONS: Record<ClaimStatus, string> = {
  verified: "Backed by cited code or tickets.",
  inferred: "Likely, but no evidence confirms it.",
  unknown: "The code and tickets cannot establish it.",
  needs_clarification: "A person has to decide.",
};

const evidenceKindSchema = z.enum(["code", "documentation", "decision", "jira_issue"]);
export type EvidenceKind = z.infer<typeof evidenceKindSchema>;

export const evidenceSchema = z.object({
  id: z.string().min(1),
  kind: evidenceKindSchema,
  reference: z.string().min(1),
  url: z.url().optional(),
  lines: z.object({ start: z.number().int().positive(), end: z.number().int().positive() }).optional(),
  excerpt: z.string().min(1),
});
export type Evidence = z.infer<typeof evidenceSchema>;

export const claimSchema = z.object({
  text: z.string().min(1),
  status: claimStatusSchema,
  evidenceIds: z.array(z.string().min(1)).default([]),
});
export type Claim = z.infer<typeof claimSchema>;
