import "server-only";
import { getConnection } from "@/features/integrations/connections";
import type { Database } from "@/infrastructure/db/client";
import { findProvider } from "@/integrations/registry";
import type { Project } from "./queries";

export type ProjectIntegrations = {
  sourceName: string;
  trackerName: string;
  issueKeyExample: string;
  needsReconnect: boolean;
};

export async function projectIntegrations(db: Database, project: Project): Promise<ProjectIntegrations> {
  const [source, tracker] = await Promise.all([
    getConnection(db, project.organizationId, project.sourceConnectionId),
    getConnection(db, project.organizationId, project.trackerConnectionId),
  ]);
  const sourceProvider = source && findProvider(source.provider);
  const trackerProvider = tracker && findProvider(tracker.provider);
  return {
    sourceName: sourceProvider?.name ?? "Code source",
    trackerName: trackerProvider?.name ?? "Issue tracker",
    issueKeyExample:
      trackerProvider?.kind === "tracker" ? trackerProvider.issueKeyExample(project.trackerResourceId) : "",
    needsReconnect: source?.status === "needs_reconnect" || tracker?.status === "needs_reconnect",
  };
}
