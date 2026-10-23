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

// Drizzle wraps driver errors, so walk the cause chain to find the Postgres code.
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUniqueViolation(error.cause);
}

// Reconnecting an account refreshes its label, metadata and tokens and clears needs_reconnect.
export async function saveAccounts(
  db: Database,
  input: { organizationId: string; userId: string; provider: ProviderDescriptor; accounts: ConnectedAccount[] },
): Promise<SaveOutcome> {
  const { organizationId, provider } = input;
  const accounts = input.accounts.map((account) => ({
    account,
    exclusiveKey: provider.exclusive ? `${provider.id}:${account.externalId}` : null,
  }));

  try {
    return await db.transaction(async (tx) => {
      const keys = accounts.flatMap(({ exclusiveKey }) => (exclusiveKey ? [exclusiveKey] : []));
      const taken = new Set(
        keys.length
          ? (
              await tx
                .select({ exclusiveKey: integrationConnection.exclusiveKey })
                .from(integrationConnection)
                .where(
                  and(
                    inArray(integrationConnection.exclusiveKey, keys),
                    ne(integrationConnection.organizationId, organizationId),
                  ),
                )
            ).flatMap((row) => (row.exclusiveKey ? [row.exclusiveKey] : []))
          : [],
      );
      const keep = accounts.filter(({ exclusiveKey }) => !exclusiveKey || !taken.has(exclusiveKey));
      if (!keep.length) return "taken";

      const grantId = randomUUID();
      for (const { account, exclusiveKey } of keep) {
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
          exclusiveKey,
        };
        await tx
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
    });
  } catch (error) {
    // The exclusive key is the only unique constraint these writes do not upsert on: another organization won the race.
    if (isUniqueViolation(error)) return "taken";
    throw error;
  }
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
