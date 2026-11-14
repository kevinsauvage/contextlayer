import { and, eq, gte, sql } from "drizzle-orm";
import { AnalysisLimitError } from "@/core/errors";
import type { Database } from "@/infrastructure/db/client";
import { analysis } from "@/infrastructure/db/schema";
import type { Env } from "@/infrastructure/env";
import { first } from "@/lib/first";

export type RunLimits = {
  perUserPerDay: number;
  totalPerDay: number;
  perUserPerMinute: number;
};

export const runLimitsOf = (env: Env): RunLimits => ({
  perUserPerDay: env.ANALYSIS_PER_USER_PER_DAY,
  totalPerDay: env.ANALYSIS_TOTAL_PER_DAY,
  perUserPerMinute: env.ANALYSIS_PER_USER_PER_MINUTE,
});

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

// A day is UTC: the limit protects the deployment's AI budget, not a person's local evening.
const startOfDay = (now: Date) => new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS);

// Counted from the `analysis` rows every run writes, so a restart, a retry and a fresh request all count once.
export async function assertRunAllowed(
  db: Database,
  userId: string,
  limits: RunLimits,
  now = new Date(),
): Promise<void> {
  const runsSince = async (userId: string | undefined, since: Date) => {
    const where = userId
      ? and(eq(analysis.createdByUserId, userId), gte(analysis.createdAt, since))
      : gte(analysis.createdAt, since);
    const row = first(
      await db
        .select({ total: sql<number>`count(*)::int` })
        .from(analysis)
        .where(where),
    );
    return row.total;
  };

  const [byUserToday, totalToday, byUserMinute] = await Promise.all([
    runsSince(userId, startOfDay(now)),
    runsSince(undefined, startOfDay(now)),
    runsSince(userId, new Date(now.getTime() - MINUTE_MS)),
  ]);

  if (byUserToday >= limits.perUserPerDay)
    throw new AnalysisLimitError("You have reached your daily analysis limit. Try again tomorrow.");
  if (totalToday >= limits.totalPerDay)
    throw new AnalysisLimitError("The daily analysis limit is reached. Try again tomorrow.");
  if (byUserMinute >= limits.perUserPerMinute)
    throw new AnalysisLimitError("You are running analyses too quickly. Wait a minute and try again.");
}
