"use server";

import { refresh } from "next/cache";
import { requireOrgAdmin } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";
import type { ActionState } from "@/lib/action-state";
import { deleteConnection, projectsUsingConnection } from "./connections";

// Projects keep a foreign key to their connections, so a connection in use cannot be removed from under them.
export async function disconnectConnection(connectionId: string): Promise<ActionState> {
  const { organizationId } = await requireOrgAdmin();
  const db = getDb();
  const projects = await projectsUsingConnection(db, organizationId, connectionId);
  if (projects.length) {
    const names = projects.map((p) => `"${p.name}"`).join(", ");
    return {
      error: `Still used by ${names}. Delete ${projects.length > 1 ? "those projects" : "that project"} first.`,
    };
  }
  await deleteConnection(db, organizationId, connectionId);
  refresh();
  return {};
}
