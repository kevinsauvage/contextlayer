import { randomUUID } from "node:crypto";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import type { ConnectedAccount, ProviderDescriptor } from "@/core/integrations/provider";
import { encrypt } from "@/infrastructure/crypto";
import type { Database } from "@/infrastructure/db/client";
import { integrationConnection, project } from "@/infrastructure/db/schema";
import { isUuid } from "@/lib/uuid";

export type Connection = typeof integrationConnection.$inferSelect;

export type ConnectionSummary = Pick<Connection, "id" | "provider" | "label" | "status" | "metadata" | "createdAt"> & {
  projectCount: number;
};

export type SaveOutcome = "connected" | "taken";

const byOrg = (organizationId: string) => eq(integrationConnection.organizationId, organizationId);

export async function getConnection(db: Database, organizationId: string, connectionId: string) {
  if (!isUuid(connectionId)) return null;
  const [row] = await db
    .select()
    .from(integrationConnection)
    .where(and(eq(integrationConnection.id, connectionId), byOrg(organizationId)));
  return row ?? null;
}

export async function listConnections(db: Database, organizationId: string): Promise<ConnectionSummary[]> {
  const usage = db
    .select({
      connectionId: sql<string>`unnest(array[${project.sourceConnectionId}, ${project.trackerConnectionId}])`.as(
        "connection_id",
      ),
    })
    .from(project)
    .where(eq(project.organizationId, organizationId))
    .as("usage");
  return db
    .select({
      id: integrationConnection.id,
      provider: integrationConnection.provider,
      label: integrationConnection.label,
      status: integrationConnection.status,
      metadata: integrationConnection.metadata,
      createdAt: integrationConnection.createdAt,
      projectCount: sql<number>`count(${usage.connectionId})::int`,
    })
    .from(integrationConnection)
    .leftJoin(usage, eq(usage.connectionId, integrationConnection.id))
    .where(byOrg(organizationId))
    .groupBy(integrationConnection.id)
    .orderBy(integrationConnection.createdAt);
}

async function takenElsewhere(db: Database, organizationId: string, provider: string, externalIds: string[]) {
  const rows = await db
    .select({ externalId: integrationConnection.externalId })
    .from(integrationConnection)
    .where(
      and(
        eq(integrationConnection.provider, provider),
        inArray(integrationConnection.externalId, externalIds),
        ne(integrationConnection.organizationId, organizationId),
      ),
    );
  return new Set(rows.map((row) => row.externalId));
}

// Reconnecting an account refreshes its label, metadata and tokens and clears needs_reconnect.
export async function saveAccounts(
  db: Database,
  input: { organizationId: string; userId: string; provider: ProviderDescriptor; accounts: ConnectedAccount[] },
): Promise<SaveOutcome> {
  const { organizationId, provider } = input;
  const taken = provider.exclusive
    ? await takenElsewhere(
        db,
        organizationId,
        provider.id,
        input.accounts.map((account) => account.externalId),
      )
    : new Set<string>();
  const accounts = input.accounts.filter((account) => !taken.has(account.externalId));
  if (!accounts.length) return "taken";

  const grantId = randomUUID();
  for (const account of accounts) {
    const fields = {
      label: account.label,
      metadata: account.metadata,
      status: "active" as const,
      accessTokenEnc: account.tokens && encrypt(account.tokens.accessToken),
      refreshTokenEnc: account.tokens && encrypt(account.tokens.refreshToken),
      tokenExpiresAt: account.tokens?.expiresAt ?? null,
      grantId: account.tokens ? grantId : null,
      connectedByUserId: input.userId,
      updatedAt: new Date(),
    };
    await db
      .insert(integrationConnection)
      .values({ organizationId, provider: provider.id, externalId: account.externalId, ...fields })
      .onConflictDoUpdate({
        target: [
          integrationConnection.organizationId,
          integrationConnection.provider,
          integrationConnection.externalId,
        ],
        set: fields,
      });
  }
  return "connected";
}

export async function projectsUsingConnection(db: Database, organizationId: string, connectionId: string) {
  return db
    .select({ id: project.id, name: project.name })
    .from(project)
    .where(
      and(
        eq(project.organizationId, organizationId),
        or(eq(project.sourceConnectionId, connectionId), eq(project.trackerConnectionId, connectionId)),
      ),
    );
}

export async function deleteConnection(db: Database, organizationId: string, connectionId: string) {
  await db.delete(integrationConnection).where(and(eq(integrationConnection.id, connectionId), byOrg(organizationId)));
}
