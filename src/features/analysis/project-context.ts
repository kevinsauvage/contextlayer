import "server-only";
import type { ContextSource, IssueTracker } from "@/core/context/source";
import { jiraAccessToken } from "@/features/integrations/jira-access";
import { getJiraConnection, type Project } from "@/features/projects/queries";
import type { Database } from "@/infrastructure/db/client";
import { GithubSource } from "@/integrations/github/source";
import { JiraClient } from "@/integrations/jira/client";

export type ProjectContext = { source: ContextSource; tracker: IssueTracker };

export async function buildProjectContext(db: Database, project: Project): Promise<ProjectContext> {
  const connection = await getJiraConnection(db, project.organizationId, project.jiraConnectionId);
  if (!connection) throw new Error("The Jira connection for this project no longer exists");

  return {
    source: await GithubSource.connect(project.githubInstallationId, { owner: project.repoOwner, name: project.repoName }),
    tracker: new JiraClient(
      { cloudId: connection.cloudId, siteUrl: connection.siteUrl },
      project.jiraProjectKey,
      () => jiraAccessToken(db, connection),
    ),
  };
}
