import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { ProviderIcon } from "@/components/integrations/provider-icon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getProject } from "@/features/projects/queries";
import { projectIntegrations } from "@/features/projects/view";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";

// Shared shell for the two ways of working on a project: drafting a ticket and auditing one.
export default async function ProjectLayout({ params, children }: LayoutProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  const { organizationId, isAdmin } = await requireOrgContext();
  const db = getDb();
  const project = await getProject(db, organizationId, projectId);
  if (!project) notFound();
  const integrations = await projectIntegrations(db, project);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={<Link href="/projects">Projects</Link>}
        title={project.name}
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5">
              <ProviderIcon kind="source" className="size-3.5" />
              {integrations.sourceName} · {project.sourceResourceLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <ProviderIcon kind="tracker" className="size-3.5" />
              {integrations.trackerName} · {project.trackerResourceLabel}
            </span>
          </span>
        }
      />

      {integrations.needsReconnect && (
        <Alert variant="destructive">
          <AlertDescription>
            A connection used by this project expired.{" "}
            {isAdmin ? (
              <Link href="/settings/integrations" className="underline">
                Reconnect it in Integrations
              </Link>
            ) : (
              "Ask an organization admin to reconnect it."
            )}
          </AlertDescription>
        </Alert>
      )}

      <ProjectTabs projectId={project.id} />
      {children}
    </div>
  );
}
