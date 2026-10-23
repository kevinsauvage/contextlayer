import "server-only";
import type { ContextSource, IssueTracker } from "@/core/context/source";
import { resolveSource, resolveTracker } from "@/features/integrations/resolve";
import type { Project } from "@/features/projects/queries";
import type { Database } from "@/infrastructure/db/client";

export type ProjectContext = { source: ContextSource; tracker: IssueTracker };

export async function buildProjectContext(db: Database, project: Project): Promise<ProjectContext> {
  const [source, tracker] = await Promise.all([
    resolveSource(db, project.organizationId, project.sourceConnectionId),
    resolveTracker(db, project.organizationId, project.trackerConnectionId),
  ]);
  return {
    source: await source.provider.openSource(source.context, project.sourceResourceId),
    tracker: tracker.provider.openTracker(tracker.context, project.trackerResourceId),
  };
}
