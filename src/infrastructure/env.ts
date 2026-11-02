import "server-only";
import { z } from "zod";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    ENCRYPTION_KEY: z
      .string()
      .refine((v) => Buffer.from(v, "base64").length === 32, "must be 32 bytes, base64-encoded"),
    AI_MODEL: z.string().min(1).default("anthropic/claude-sonnet-5.5"),
    AI_BASE_URL: z.url().optional(),
    AI_API_KEY: z.string().optional(),
    AI_STRUCTURED_OUTPUTS: z.stringbool().default(true),
    AI_JUDGE_MODEL: z.string().min(1).optional(),
    AI_JUDGE_BASE_URL: z.url().optional(),
    AI_JUDGE_API_KEY: z.string().optional(),
    AI_JUDGE_STRUCTURED_OUTPUTS: z.stringbool().optional(),
    GITHUB_APP_ID: z.string().optional(),
    GITHUB_APP_PRIVATE_KEY: z.string().optional(),
    GITHUB_APP_SLUG: z.string().optional(),
    GITHUB_APP_CLIENT_ID: z.string().optional(),
    GITHUB_APP_CLIENT_SECRET: z.string().optional(),
    JIRA_CLIENT_ID: z.string().optional(),
    JIRA_CLIENT_SECRET: z.string().optional(),
    // Swaps GitHub, Jira and the model for a built-in sample repository, an in-memory tracker and a canned generator,
    // so the end-to-end test runs without credentials. Anyone could sign in to such a server and "publish", so it is
    // refused unless the app only answers on this machine.
    E2E_FAKE_PROVIDERS: z.stringbool().default(false),
  })
  .refine((env) => !env.E2E_FAKE_PROVIDERS || LOCAL_HOSTS.has(new URL(env.BETTER_AUTH_URL).hostname), {
    message: "E2E_FAKE_PROVIDERS is only allowed when BETTER_AUTH_URL is localhost",
    path: ["E2E_FAKE_PROVIDERS"],
  });

export type Env = z.infer<typeof envSchema>;

class MissingConfigError extends Error {}

// A blank `KEY=` line in .env.example-derived files means "unset", not an empty value.
export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(Object.fromEntries(Object.entries(source).filter(([, value]) => value !== "")));
}

let cached: Env | undefined;

export function getEnv(): Env {
  return (cached ??= parseEnv(process.env));
}

export const hasEnv = (...keys: (keyof Env)[]) => keys.every((key) => Boolean(getEnv()[key]));

export function requireEnv<K extends keyof Env>(...keys: K[]): Required<Pick<Env, K>> {
  const env = getEnv();
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) throw new MissingConfigError(`Missing environment variables: ${missing.join(", ")}`);
  return env as unknown as Required<Pick<Env, K>>;
}
