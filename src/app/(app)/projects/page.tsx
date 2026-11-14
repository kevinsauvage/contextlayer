import { ArrowRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ConnectNotice } from "@/components/integrations/connect-notice";
import { PageHeader } from "@/components/page-header";
import { ProviderIcon } from "@/components/integrations/provider-icon";
import { SetupChecklist } from "@/components/integrations/setup-checklist";
import { buttonVariants } from "@/components/ui/button";
import { integrationsOverview, providerNames } from "@/features/integrations/overview";
import { setupSteps } from "@/features/integrations/setup";
import { listProjects } from "@/features/projects/queries";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";

export const metadata: Metadata = { title: "Projects" };

export default async function Page({ searchParams }: PageProps<"/projects">) {
  const { organizationId, isAdmin } = await requireOrgContext();
  const db = getDb();
  const [projects, overview, params] = await Promise.all([
    listProjects(db, organizationId),
    integrationsOverview(db, organizationId),
    searchParams,
  ]);
  const names = providerNames(overview);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Projects"
        description="Each project pairs a repository with a ticket project. Open one to draft or audit a ticket."
        actions={
          isAdmin &&
          projects.length > 0 && (
            <Link href="/projects/new" className={buttonVariants()}>
              <Plus /> New project
            </Link>
          )
        }
      />

      <ConnectNotice params={params} providerNames={names} />

      {projects.length === 0 && <SetupChecklist isAdmin={isAdmin} steps={setupSteps(overview, "/projects")} />}

      {projects.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map(({ project, sourceProvider, trackerProvider }) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="group flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40 focus-visible:outline-2"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted/70 text-sm font-semibold text-muted-foreground">
                  {project.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-medium">{project.name}</span>
                  <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <ProviderIcon kind="source" className="size-3.5 shrink-0" />
                      <span className="truncate">
                        {names[sourceProvider]} · {project.sourceResourceLabel}
                      </span>
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <ProviderIcon kind="tracker" className="size-3.5 shrink-0" />
                      <span className="truncate">
                        {names[trackerProvider]} · {project.trackerResourceLabel}
                      </span>
                    </span>
                  </span>
                </span>
                <ArrowRight
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
