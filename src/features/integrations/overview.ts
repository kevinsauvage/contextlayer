import "server-only";
import { describeProvider, type ProviderDescriptor, type ProviderKind } from "@/core/integrations/provider";
import type { Database } from "@/infrastructure/db/client";
import { listProviders } from "@/integrations/registry";
import { listConnections, type ConnectionSummary } from "./connections";

export type ProviderOverview = ProviderDescriptor & { configured: boolean; connections: ConnectionSummary[] };

export async function integrationsOverview(db: Database, organizationId: string): Promise<ProviderOverview[]> {
  const connections = await listConnections(db, organizationId);
  return listProviders().map((provider) => ({
    ...describeProvider(provider),
    configured: provider.isConfigured(),
    connections: connections.filter((connection) => connection.provider === provider.id),
  }));
}

export const ofKind = (overview: ProviderOverview[], kind: ProviderKind) =>
  overview.filter((provider) => provider.kind === kind);

export const providerNames = (overview: ProviderOverview[]) =>
  Object.fromEntries(overview.map((provider) => [provider.id, provider.name]));
