"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { jiraAccessToken } from "@/features/integrations/jira-access";
import type { ActionState } from "@/features/ticket-creation/actions";
import { requireOrgAdmin } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";
import { project } from "@/infrastructure/db/schema";
import { listInstallationRepos } from "@/integrations/github/app";
import { listJiraProjects } from "@/integrations/jira/client";
import { getGithubInstallation, getJiraConnection } from "./queries";

const projectInputSchema = z.object({
  name: z.string().trim().min(2, "Enter a project name").max(100),
  installationId: z.coerce.number().int().positive(),
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "Choose a repository"),
  connectionId: z.uuid("Choose a Jira site"),
  jiraProjectKey: z.string().min(1, "Choose a Jira project"),
});

export async function createProject(_: ActionState, formData: FormData): Promise<ActionState> {
  const input = projectInputSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: input.error.issues[0].message };

  const { organizationId } = await requireOrgAdmin();
  const db = getDb();
  const [installation, connection] = await Promise.all([
    getGithubInstallation(db, organizationId, input.data.installationId),
    getJiraConnection(db, organizationId, input.data.connectionId),
  ]);
  if (!installation || !connection) return { error: "Integration not found" };

  const [owner, name] = input.data.repo.split("/");
  const [repos, jiraProjects] = await Promise.all([
    listInstallationRepos(installation.id),
    jiraAccessToken(db, connection).then((token) => listJiraProjects(connection, token)),
  ]);
  if (!repos.some((repo) => repo.owner === owner && repo.name === name)) return { error: "Repository is not accessible to the GitHub App" };
  if (!jiraProjects.some((p) => p.key === input.data.jiraProjectKey)) return { error: "Jira project not found" };

  const [created] = await db
    .insert(project)
    .values({
      organizationId,
      name: input.data.name,
      githubInstallationId: installation.id,
      repoOwner: owner,
      repoName: name,
      jiraConnectionId: connection.id,
      jiraProjectKey: input.data.jiraProjectKey,
    })
    .returning({ id: project.id });
  redirect(`/projects/${created.id}`);
}
