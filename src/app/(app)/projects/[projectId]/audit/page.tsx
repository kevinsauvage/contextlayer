import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { getProject } from "@/features/projects/queries";
import { projectIntegrations } from "@/features/projects/view";
import { createAuditAnalysis } from "@/features/ticket-audit/actions";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";

export const maxDuration = 300;

export const metadata: Metadata = { title: "Audit a ticket" };

export default async function Page({ params }: PageProps<"/projects/[projectId]/audit">) {
  const { projectId } = await params;
  const { organizationId } = await requireOrgContext();
  const db = getDb();
  const project = await getProject(db, organizationId, projectId);
  if (!project) notFound();
  const integrations = await projectIntegrations(db, project);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        breadcrumb={<Link href={`/projects/${project.id}`}>{project.name}</Link>}
        title="Audit a ticket"
        description={`Check an existing ${integrations.trackerName} ticket against the code: what it leaves ambiguous, what it gets wrong, and what it should say instead.`}
      />
      <ActionForm
        action={createAuditAnalysis.bind(null, project.id)}
        name="issueKey"
        title={`${integrations.trackerName} ticket`}
        description="Paste the ticket key or its link."
        placeholder={integrations.issueKeyExample}
        submitLabel="Audit ticket"
        pendingLabel="Auditing…"
      />
    </div>
  );
}
