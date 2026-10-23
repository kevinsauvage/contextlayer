import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listProjects } from "@/features/projects/queries";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";

export default async function Page() {
  const { organizationId, role } = await requireOrgContext();
  const projects = await listProjects(getDb(), organizationId);
  const isAdmin = role === "owner" || role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        {isAdmin && (
          <Link href="/projects/new" className={buttonVariants()}>
            New project
          </Link>
        )}
      </div>
      {projects.length === 0 && (
        <p className="text-muted-foreground">
          No projects yet. Connect{" "}
          <Link href="/settings/integrations" className="underline">
            GitHub and Jira
          </Link>
          , then link a repository to a Jira project.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle>{p.name}</CardTitle>
                <CardDescription>
                  {p.repoOwner}/{p.repoName} · Jira {p.jiraProjectKey}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
