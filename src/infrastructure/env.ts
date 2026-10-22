import "server-only";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  ENCRYPTION_KEY: z.string().refine((v) => Buffer.from(v, "base64").length === 32, "must be 32 bytes, base64-encoded"),
  AI_MODEL: z.string().min(1).default("anthropic/claude-sonnet-5.5"),
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  GITHUB_APP_SLUG: z.string().optional(),
  GITHUB_APP_CLIENT_ID: z.string().optional(),
  GITHUB_APP_CLIENT_SECRET: z.string().optional(),
  JIRA_CLIENT_ID: z.string().optional(),
  JIRA_CLIENT_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export class MissingConfigError extends Error {}

let cached: Env | undefined;

export function getEnv(): Env {
  return (cached ??= envSchema.parse(process.env));
}

export function requireEnv<K extends keyof Env>(...keys: K[]): Required<Pick<Env, K>> {
  const env = getEnv();
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) throw new MissingConfigError(`Missing environment variables: ${missing.join(", ")}`);
  return env as unknown as Required<Pick<Env, K>>;
}
