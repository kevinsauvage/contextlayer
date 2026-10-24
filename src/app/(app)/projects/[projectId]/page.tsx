import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { AnalysisStatusBadge } from "@/components/analysis/analysis-status-badge";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { PageHeader } from "@/components/page-header";
import { ProviderIcon } from "@/components/integrations/provider-icon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { firstLine, readAnalysisInput, requestOf } from "@/features/analysis/input";
import { getProject, listAnalyses } from "@/features/projects/queries";
import { projectIntegrations } from "@/features/projects/view";
import { createAuditAnalysis } from "@/features/ticket-audit/actions";
import { createTicketAnalysis } from "@/features/ticket-creation/actions";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";

export const maxDuration = 300;

export const metadata: Metadata = { title: "Project" };

export default async function Page({ params }: PageProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  const { organizationId, isAdmin } = await requireOrgContext();
  const db = getDb();
  const project = await getProject(db, organizationId, projectId);
  if (!project) notFound();
  const [analyses, integrations] = await Promise.all([listAnalyses(db, project.id), projectIntegrations(db, project)]);

  return (
    <div className="flex flex-col gap-8">
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

      <div className="grid items-start gap-4 md:grid-cols-[3fr_2fr]">
        <ActionForm
          action={createTicketAnalysis.bind(null, project.id)}
          name="request"
          title="Draft a ticket"
          description="Describe what you need, in a line or a few paragraphs: what should change, where, why, and any constraints. ContextLayer finds evidence in the code and drafts the ticket."
          placeholder={
            'Change the home page hero heading to "Hello, I\'m Kévin".\nKeep the gradient on the second line.'
          }
          multiline
          submitLabel="Investigate"
          pendingLabel="Investigating…"
        />
        <ActionForm
          action={createAuditAnalysis.bind(null, project.id)}
          name="issueKey"
          title="Audit a ticket"
          description={`Check an existing ${integrations.trackerName} ticket against the code. Paste its key or link.`}
          placeholder={integrations.issueKeyExample}
          submitLabel="Audit"
          pendingLabel="Auditing…"
        />
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="history-heading">
        <h2 id="history-heading" className="font-medium">
          History
        </h2>
        {analyses.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No analyses yet. Draft or audit a ticket above to get started.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {analyses.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/projects/${project.id}/analyses/${a.id}`}
                  className="flex items-center gap-3 p-3 text-sm hover:bg-muted/50"
                >
                  <Badge variant="outline" className="w-14">
                    {a.kind === "create" ? "Draft" : "Audit"}
                  </Badge>
                  <span className="flex-1 truncate">{firstLine(requestOf(readAnalysisInput(a))) || "Untitled"}</span>
                  <AnalysisStatusBadge analysis={a} />
                  <time className="hidden text-muted-foreground sm:inline" dateTime={a.createdAt.toISOString()}>
                    {a.createdAt.toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isAdmin && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-destructive/30 p-4">
          <div>
            <h2 className="font-medium">Delete project</h2>
            <p className="text-sm text-muted-foreground">Removes the project and its analysis history.</p>
          </div>
          <DeleteProjectButton projectId={project.id} name={project.name} />
        </section>
      )}
    </div>
  );
}
