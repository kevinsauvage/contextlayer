import type { z } from "zod";

export const firstIssueMessage = (error: z.ZodError, fallback = "Invalid input") =>
  error.issues[0]?.message ?? fallback;
