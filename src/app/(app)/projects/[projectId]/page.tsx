import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { getProject, listAnalyses } from "@/features/projects/queries";
import { createAuditAnalysis } from "@/features/ticket-audit/actions";
import { createTicketAnalysis } from "@/features/ticket-creation/actions";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";

export const maxDuration = 300;

export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { organizationId } = await requireOrgContext();
  const db = getDb();
  const project = await getProject(db, organizationId, projectId);
  if (!project) notFound();
  const analyses = await listAnalyses(db, project.id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="text-sm text-muted-foreground">{project.repoOwner}/{project.repoName} · Jira {project.jiraProjectKey}</p>
      </div>

      <ActionForm
        action={createTicketAnalysis.bind(null, project.id)}
        name="title"
        label="Create a ticket from a title"
        placeholder="Improve checkout accessibility"
        submitLabel="Investigate"
        pendingLabel="Investigating…"
      />
      <ActionForm
        action={createAuditAnalysis.bind(null, project.id)}
        name="issueKey"
        label="Audit an existing Jira ticket"
        placeholder={`${project.jiraProjectKey}-123`}
        submitLabel="Audit"
        pendingLabel="Auditing…"
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">History</h2>
        {analyses.length === 0 && <p className="text-sm text-muted-foreground">Nothing analyzed yet.</p>}
        <ul className="flex flex-col divide-y rounded-lg border">
          {analyses.map((a) => (
            <li key={a.id}>
              <Link href={`/projects/${project.id}/analyses/${a.id}`} className="flex items-center gap-3 p-3 text-sm hover:bg-muted/50">
                <Badge variant="outline">{a.kind === "create" ? "Create" : "Audit"}</Badge>
                <span className="flex-1 truncate">{(a.input as { title?: string; issueKey?: string }).title ?? (a.input as { issueKey?: string }).issueKey}</span>
                {a.publishedIssueKey && <Badge>{a.publishedIssueKey}</Badge>}
                {a.status === "failed" && <Badge variant="destructive">Failed</Badge>}
                <time className="text-muted-foreground" dateTime={a.createdAt.toISOString()}>{a.createdAt.toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}</time>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
