import "server-only";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/infrastructure/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

function createDb() {
  const env = getEnv();
  // On a serverless host each instance opens its own pool, so the size comes from the host's limits, and a pooler
  // in front of Postgres cannot use prepared statements (`prepare: false`).
  const sql = (globalForDb.sql ??= postgres(env.DATABASE_URL, {
    max: env.DB_POOL_SIZE,
    prepare: env.DB_PREPARE,
  }));
  return drizzle(sql, { schema });
}

let cached: ReturnType<typeof createDb> | undefined;

export const getDb = () => (cached ??= createDb());
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
