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
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <ActionForm
        action={createAuditAnalysis.bind(null, project.id)}
        name="issueKey"
        title={`Audit an existing ${integrations.trackerName} ticket`}
        description={`Check it against the code: what it leaves ambiguous, what it gets wrong, and what it should say instead. Paste the key or the link.`}
        placeholder={integrations.issueKeyExample}
        submitLabel="Audit ticket"
        pendingLabel="Auditing…"
      />
      <aside className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        <h2 className="font-medium text-foreground">What the audit checks</h2>
        <p>Unclear scope and missing acceptance criteria.</p>
        <p>Claims that conflict with the code or that the code already implements.</p>
        <p>Duplicate work, unsupported technical assumptions, and decisions a person must make.</p>
      </aside>
    </div>
  );
}
