import { ArrowRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ProviderIcon } from "@/components/integrations/provider-icon";
import { SetupChecklist } from "@/components/integrations/setup-checklist";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { integrationsOverview, ofKind, providerNames } from "@/features/integrations/overview";
import { listProjects } from "@/features/projects/queries";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";

export const metadata: Metadata = { title: "Projects" };

const hasConnection = (providers: { connections: unknown[] }[]) => providers.some((p) => p.connections.length > 0);

export default async function Page() {
  const { organizationId, isAdmin } = await requireOrgContext();
  const db = getDb();
  const [projects, overview] = await Promise.all([
    listProjects(db, organizationId),
    integrationsOverview(db, organizationId),
  ]);
  const names = providerNames(overview);
  const sourceNames = ofKind(overview, "source")
    .map((p) => p.name)
    .join(" or ");
  const trackerNames = ofKind(overview, "tracker")
    .map((p) => p.name)
    .join(" or ");

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

      {projects.length === 0 && (
        <SetupChecklist
          isAdmin={isAdmin}
          steps={[
            {
              done: hasConnection(ofKind(overview, "source")),
              title: "Connect your code",
              description: `Give read-only access to repositories on ${sourceNames}.`,
              href: "/settings/integrations",
              cta: "Connect",
            },
            {
              done: hasConnection(ofKind(overview, "tracker")),
              title: "Connect your tickets",
              description: `Link ${trackerNames} so drafts can be published after approval.`,
              href: "/settings/integrations",
              cta: "Connect",
            },
            {
              done: false,
              title: "Create a project",
              description: "Pick one repository and one ticket project.",
              href: "/projects/new",
              cta: "Create",
            },
          ]}
        />
      )}

      {projects.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.map(({ project, sourceProvider, trackerProvider }) => (
            <li key={project.id}>
              <Link href={`/projects/${project.id}`} className="group block rounded-xl focus-visible:outline-2">
                <Card className="h-full transition-colors group-hover:bg-muted/40">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      <span className="truncate">{project.name}</span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </CardTitle>
                    <CardDescription className="flex flex-col gap-1">
                      <span className="flex items-center gap-1.5 truncate">
                        <ProviderIcon kind="source" className="size-3.5" />
                        {project.sourceResourceLabel}
                        <span className="sr-only">on {names[sourceProvider]}</span>
                      </span>
                      <span className="flex items-center gap-1.5 truncate">
                        <ProviderIcon kind="tracker" className="size-3.5" />
                        {project.trackerResourceLabel}
                        <span className="sr-only">on {names[trackerProvider]}</span>
                      </span>
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
