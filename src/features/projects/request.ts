import { cache } from "react";
import { getDb, type Database } from "@/infrastructure/db/client";
import { getProject, type Project } from "./queries";
import { projectIntegrations, type ProjectIntegrations } from "./view";

export type RequestProject = { db: Database; project: Project; integrations: ProjectIntegrations };

// The project layout and the page under it ask for the same project and its integrations. React caches this per
// request, keyed on the ids, so one page load costs one project lookup and one connection lookup per side.
export const projectForRequest = cache(
  async (organizationId: string, projectId: string): Promise<RequestProject | null> => {
    const db = getDb();
    const project = await getProject(db, organizationId, projectId);
    if (!project) return null;
    return { db, project, integrations: await projectIntegrations(db, project) };
  },
);
