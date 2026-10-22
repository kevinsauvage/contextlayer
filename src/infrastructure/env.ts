import "server-only";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

/** Validated server environment. Extend the schema as integrations are introduced. */
export const env = envSchema.parse(process.env);
