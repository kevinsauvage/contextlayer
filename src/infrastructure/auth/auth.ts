import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { getDb } from "@/infrastructure/db/client";
import { getEnv } from "@/infrastructure/env";
import * as schema from "@/infrastructure/db/schema";

function createAuth() {
  const env = getEnv();
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    emailAndPassword: { enabled: true, minPasswordLength: 10 },
    plugins: [organization(), nextCookies()],
  });
}

let cached: ReturnType<typeof createAuth> | undefined;

export const getAuth = () => (cached ??= createAuth());
