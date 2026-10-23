import { z } from "zod";
import { ticketDraftSchema } from "@/core/requirements/schemas";

export const analysisResultSchema = z.object({
  latencyMs: z.number(),
  usage: z.object({ inputTokens: z.number(), outputTokens: z.number() }).optional(),
  draft: ticketDraftSchema,
});
