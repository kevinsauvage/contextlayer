import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Database } from "@/infrastructure/db/client";
import * as schema from "@/infrastructure/db/schema";

export async function migratedDb(): Promise<Database> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

export async function seedOrgs(db: Database, orgIds: string[]) {
  const now = new Date();
  await db.insert(schema.user).values({ id: "u1", name: "U", email: "u@x.test", createdAt: now, updatedAt: now });
  await db.insert(schema.organization).values(orgIds.map((id) => ({ id, name: id, slug: id, createdAt: now })));
}
