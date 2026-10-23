import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listGithubInstallations, listJiraConnections } from "@/features/projects/queries";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";
import { cn } from "@/lib/utils";

const NOTICES: Record<string, string> = {
  "github=connected": "GitHub connected.",
  "github=invalid": "The GitHub connection request expired or was invalid. Try again.",
  "github=forbidden": "Your GitHub account does not have access to that installation.",
  "github=taken": "That GitHub installation is already connected to another organization.",
  "github=unconfigured": "GitHub App is not configured on the server. See docs/engineering/integrations-setup.md.",
  "jira=unconfigured": "Atlassian OAuth is not configured on the server. See docs/engineering/integrations-setup.md.",
  "jira=connected": "Jira connected.",
  "jira=invalid": "The Jira connection request expired or was invalid. Try again.",
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { organizationId, role } = await requireOrgContext();
  const db = getDb();
  const [installations, connections, params] = await Promise.all([
    listGithubInstallations(db, organizationId),
    listJiraConnections(db, organizationId),
    searchParams,
  ]);
  const isAdmin = role === "owner" || role === "admin";
  const notice = Object.entries(params)
    .map(([k, v]) => NOTICES[`${k}=${v}`])
    .find(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Integrations</h1>
      {notice && (
        <p role="status" className="rounded-lg border bg-muted p-3 text-sm">
          {notice}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>GitHub</CardTitle>
          <CardDescription>
            Read-only access to the repositories you choose, through the ContextLayer GitHub App.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ul className="text-sm">
            {installations.map((i) => (
              <li key={i.id}>{i.accountLogin}</li>
            ))}
            {!installations.length && <li className="text-muted-foreground">Not connected.</li>}
          </ul>
          {isAdmin && (
            <div className="flex gap-2">
              <a href="/api/github/install" className={cn(buttonVariants({ variant: "outline" }), "w-fit")}>
                {installations.length ? "Sync from GitHub" : "Connect GitHub"}
              </a>
              <a href="/api/github/install?add" className={cn(buttonVariants({ variant: "ghost" }), "w-fit")}>
                Install on another account
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jira Cloud</CardTitle>
          <CardDescription>Reads related issues and creates or updates issues only after you approve.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ul className="text-sm">
            {connections.map((c) => (
              <li key={c.id}>
                {c.siteName} <span className="text-muted-foreground">{c.siteUrl}</span>
              </li>
            ))}
            {!connections.length && <li className="text-muted-foreground">Not connected.</li>}
          </ul>
          {isAdmin && (
            <a href="/api/jira/connect" className={cn(buttonVariants({ variant: "outline" }), "w-fit")}>
              {connections.length ? "Reconnect Jira" : "Connect Jira"}
            </a>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
