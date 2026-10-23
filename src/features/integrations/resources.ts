import "server-only";
import { ReconnectRequiredError, type Resource } from "@/core/integrations/provider";
import type { Database } from "@/infrastructure/db/client";
import { resolveConnection } from "./resolve";

type ResourcesResult = { resources: Resource[] } | { error: string; status: number };

export async function listConnectionResources(
  db: Database,
  organizationId: string,
  connectionId: string,
): Promise<ResourcesResult> {
  const resolved = await resolveConnection(db, organizationId, connectionId);
  if (!resolved) return { error: "Connection not found", status: 404 };
  try {
    return { resources: await resolved.provider.listResources(resolved.context) };
  } catch (error) {
    if (error instanceof ReconnectRequiredError) return { error: error.message, status: 409 };
    console.error(`[integrations] listing ${resolved.provider.id} resources failed`, error);
    return {
      error: `Could not load ${resolved.provider.resourceNoun} list from ${resolved.provider.name}`,
      status: 502,
    };
  }
}
