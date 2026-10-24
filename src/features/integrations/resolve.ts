import "server-only";
import type {
  ConnectionContext,
  IntegrationProvider,
  SourceProvider,
  TrackerProvider,
} from "@/core/integrations/provider";
import { ConnectionMissingError } from "@/core/errors";
import type { Database } from "@/infrastructure/db/client";
import { findProvider } from "@/integrations/registry";
import { connectionContext } from "./access";
import { getConnection, type Connection } from "./connections";

type Resolved<P extends IntegrationProvider> = { connection: Connection; provider: P; context: ConnectionContext };

// Routes and features resolve a provider through this seam instead of importing the adapter registry.
export const providerById = (id: string): IntegrationProvider | undefined => findProvider(id);

export async function resolveConnection(
  db: Database,
  organizationId: string,
  connectionId: string,
): Promise<Resolved<IntegrationProvider> | null> {
  const connection = await getConnection(db, organizationId, connectionId);
  const provider = connection && findProvider(connection.provider);
  if (!connection || !provider) return null;
  return { connection, provider, context: connectionContext(db, connection, provider) };
}

export async function resolveSource(db: Database, organizationId: string, connectionId: string) {
  const resolved = await resolveConnection(db, organizationId, connectionId);
  if (resolved?.provider.kind !== "source")
    throw new ConnectionMissingError("The code source connection no longer exists");
  return { ...resolved, provider: resolved.provider } satisfies Resolved<SourceProvider>;
}

export async function resolveTracker(db: Database, organizationId: string, connectionId: string) {
  const resolved = await resolveConnection(db, organizationId, connectionId);
  if (resolved?.provider.kind !== "tracker")
    throw new ConnectionMissingError("The issue tracker connection no longer exists");
  return { ...resolved, provider: resolved.provider } satisfies Resolved<TrackerProvider>;
}
