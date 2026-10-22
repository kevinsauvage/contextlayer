import "server-only";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/infrastructure/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

function createDb() {
  const sql = (globalForDb.sql ??= postgres(getEnv().DATABASE_URL, { max: 10 }));
  return drizzle(sql, { schema });
}

let cached: ReturnType<typeof createDb> | undefined;

export const getDb = () => (cached ??= createDb());
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
