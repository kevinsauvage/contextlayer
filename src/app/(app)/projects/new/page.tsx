import Link from "next/link";
import { ProjectForm } from "@/components/project-form";
import { listGithubInstallations, listJiraConnections } from "@/features/projects/queries";
import { requireOrgAdmin } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";

export default async function Page() {
  const { organizationId } = await requireOrgAdmin();
  const db = getDb();
  const [installations, connections] = await Promise.all([
    listGithubInstallations(db, organizationId),
    listJiraConnections(db, organizationId),
  ]);

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <h1 className="text-2xl font-semibold">New project</h1>
      {installations.length && connections.length ? (
        <ProjectForm
          installations={installations.map((i) => ({ id: i.id, label: i.accountLogin }))}
          connections={connections.map((c) => ({ id: c.id, label: c.siteName }))}
        />
      ) : (
        <p className="text-muted-foreground">
          Connect both GitHub and Jira in{" "}
          <Link href="/settings/integrations" className="underline">
            Integrations
          </Link>{" "}
          first.
        </p>
      )}
    </div>
  );
}
