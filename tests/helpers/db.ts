import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Database } from "@/infrastructure/db/client";
import * as schema from "@/infrastructure/db/schema";
import { first } from "@/lib/first";

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

export async function seedConnections(db: Database, organizationId: string) {
  const rows = await db
    .insert(schema.integrationConnection)
    .values([
      { organizationId, provider: "github", externalId: "1", label: "a", connectedByUserId: "u1" },
      { organizationId, provider: "jira", externalId: "c", label: "b", connectedByUserId: "u1" },
    ])
    .returning();
  const source = rows.find((row) => row.provider === "github");
  const tracker = rows.find((row) => row.provider === "jira");
  if (!source || !tracker) throw new Error("seeding connections failed");
  return { source, tracker };
}

type SeededConnections = Awaited<ReturnType<typeof seedConnections>>;

type ProjectOverrides = {
  name?: string;
  sourceResourceId?: string;
  trackerResourceId?: string;
  trackerResourceLabel?: string;
};

export async function seedProject(
  db: Database,
  organizationId: string,
  connections: SeededConnections,
  overrides: ProjectOverrides = {},
) {
  const name = overrides.name ?? "P";
  const sourceResourceId = overrides.sourceResourceId ?? "a/b";
  const trackerResourceId = overrides.trackerResourceId ?? name;
  return first(
    await db
      .insert(schema.project)
      .values({
        organizationId,
        name,
        sourceConnectionId: connections.source.id,
        sourceResourceId,
        sourceResourceLabel: sourceResourceId,
        trackerConnectionId: connections.tracker.id,
        trackerResourceId,
        trackerResourceLabel: overrides.trackerResourceLabel ?? trackerResourceId,
      })
      .returning(),
  );
}
