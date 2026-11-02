import "server-only";
import type { Resource, ResourceList } from "@/core/integrations/provider";
import { errorSummary } from "@/core/errors";
import { toActionError } from "@/features/errors";
import type { Database } from "@/infrastructure/db/client";
import { resolveConnection } from "./resolve";

type ResourcesResult = { resources: Resource[] } | { error: string; status: number };

async function listConnectionResources(
  db: Database,
  organizationId: string,
  connectionId: string,
): Promise<ResourcesResult> {
  const resolved = await resolveConnection(db, organizationId, connectionId);
  if (!resolved) return { error: "Connection not found", status: 404 };
  try {
    return { resources: await resolved.provider.listResources(resolved.context) };
  } catch (error) {
    const known = toActionError(error);
    if (known) return { ...known, status: 409 };
    console.error(`[integrations] listing ${resolved.provider.id} resources failed`, errorSummary(error));
    return {
      error: `Could not load ${resolved.provider.resourceNoun} list from ${resolved.provider.name}`,
      status: 502,
    };
  }
}

// Lists every connection's resources up front, so the project form renders its pickers without a client fetch.
// A failure stays a value: a revoked grant is recoverable on the same page, so it must not blank the form.
export async function resourceListsFor(
  db: Database,
  organizationId: string,
  connectionIds: string[],
): Promise<Record<string, ResourceList>> {
  const entries = await Promise.all(
    connectionIds.map(async (id) => {
      const result = await listConnectionResources(db, organizationId, id);
      return [id, "resources" in result ? { resources: result.resources } : { error: result.error }] as const;
    }),
  );
  return Object.fromEntries(entries);
}
