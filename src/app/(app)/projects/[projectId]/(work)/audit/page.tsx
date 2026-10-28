import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
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
      <ActionForm
        action={createAuditAnalysis.bind(null, project.id)}
        name="issueKey"
        title={`Audit an existing ${integrations.trackerName} ticket`}
        description={`Check it against the code: what it leaves ambiguous, what it gets wrong, and what it should say instead. Paste the key or the link.`}
        placeholder={integrations.issueKeyExample}
        submitLabel="Audit ticket"
        pendingLabel="Auditing…"
      />
    </div>
  );
}
