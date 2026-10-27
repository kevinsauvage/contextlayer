import { ProjectForm } from "@/components/projects/project-form";
import { resourceListsFor } from "@/features/integrations/resources";
import type { ProviderOverview } from "@/features/integrations/overview";
import { getDb } from "@/infrastructure/db/client";

// Reads every visible connection's resources on the server, so the pickers arrive populated and the client keeps
// only filtering and selection.
export async function ProjectFormSection({
  organizationId,
  sources,
  trackers,
}: {
  organizationId: string;
  sources: ProviderOverview[];
  trackers: ProviderOverview[];
}) {
  const connectionIds = [...sources, ...trackers].flatMap((provider) =>
    provider.connections.map((connection) => connection.id),
  );
  const resourceLists = await resourceListsFor(getDb(), organizationId, connectionIds);
  return <ProjectForm sources={sources} trackers={trackers} resourceLists={resourceLists} />;
}
