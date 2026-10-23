import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { asc, eq } from "drizzle-orm";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { getDb } from "@/infrastructure/db/client";
import { getEnv } from "@/infrastructure/env";
import * as schema from "@/infrastructure/db/schema";
import { member } from "@/infrastructure/db/schema";

function createAuth() {
  const env = getEnv();
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    emailAndPassword: { enabled: true, minPasswordLength: 10 },
    databaseHooks: {
      session: {
        create: {
          // A new session starts without an active organization; pick the user's first so a returning user skips onboarding.
          before: async (session) => {
            const [membership] = await getDb()
              .select({ organizationId: member.organizationId })
              .from(member)
              .where(eq(member.userId, session.userId))
              .orderBy(asc(member.createdAt))
              .limit(1);
            return { data: { ...session, activeOrganizationId: membership?.organizationId ?? null } };
          },
        },
      },
    },
    plugins: [organization(), nextCookies()],
  });
}

let cached: ReturnType<typeof createAuth> | undefined;

export const getAuth = () => (cached ??= createAuth());
