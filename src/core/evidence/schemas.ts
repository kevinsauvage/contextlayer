import { z } from "zod";

/** How well the available context supports a claim. Never present `inferred` as `verified`. */
export const claimStatusSchema = z.enum(["verified", "inferred", "unknown", "needs_clarification"]);
export type ClaimStatus = z.infer<typeof claimStatusSchema>;

export const evidenceKindSchema = z.enum(["code", "documentation", "decision", "jira_issue"]);
export type EvidenceKind = z.infer<typeof evidenceKindSchema>;

export const evidenceSchema = z.object({
  id: z.string().min(1),
  kind: evidenceKindSchema,
  /** File path, document path or Jira issue key. */
  reference: z.string().min(1),
  /** Optional link to the source (GitHub blob URL, Jira issue URL). */
  url: z.url().optional(),
  /** Line range for code and documentation. */
  lines: z.object({ start: z.number().int().positive(), end: z.number().int().positive() }).optional(),
  /** Short quote or summary of the relevant part of the source. */
  excerpt: z.string().min(1),
});
export type Evidence = z.infer<typeof evidenceSchema>;

export const claimSchema = z.object({
  text: z.string().min(1),
  status: claimStatusSchema,
  evidenceIds: z.array(z.string().min(1)).default([]),
});
export type Claim = z.infer<typeof claimSchema>;
