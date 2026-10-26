"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  isSafeSubdirectory,
  withResourceSubdirectory,
  type ConnectionContext,
  type IntegrationProvider,
  type Resource,
} from "@/core/integrations/provider";
import { withActionErrors } from "@/features/errors";
import { resolveSource, resolveTracker } from "@/features/integrations/resolve";
import { requireOrgAdmin } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";
import { project } from "@/infrastructure/db/schema";
import type { ActionState } from "@/lib/action-state";
import { first } from "@/lib/first";
import { firstIssueMessage } from "@/lib/zod";

const projectInputSchema = z.object({
  name: z.string().trim().min(2, "Enter a project name of at least 2 characters").max(100),
  sourceConnectionId: z.uuid("Choose where the code lives"),
  sourceResourceId: z.string().min(1, "Choose a repository"),
  sourceSubdirectory: z.string().trim().max(200).optional(),
  trackerConnectionId: z.uuid("Choose where tickets live"),
  trackerResourceId: z.string().min(1, "Choose a project or board"),
});

// Ask for the one id the form submitted instead of paging through every resource the account can see.
async function resolveResource(
  provider: IntegrationProvider,
  ctx: ConnectionContext,
  id: string,
): Promise<Resource | null> {
  if (provider.getResource) return provider.getResource(ctx, id);
  const resources = await provider.listResources(ctx);
  return resources.find((resource) => resource.id === id) ?? null;
}

export async function createProject(_: ActionState, formData: FormData): Promise<ActionState> {
  return withActionErrors(async () => {
    const input = projectInputSchema.safeParse(Object.fromEntries(formData));
    if (!input.success) return { error: firstIssueMessage(input.error) };

    const { organizationId } = await requireOrgAdmin();
    const db = getDb();
    const [source, tracker] = await Promise.all([
      resolveSource(db, organizationId, input.data.sourceConnectionId),
      resolveTracker(db, organizationId, input.data.trackerConnectionId),
    ]);
    const subdirectory = input.data.sourceSubdirectory ?? "";
    if (subdirectory && !isSafeSubdirectory(subdirectory))
      return { error: "Enter a folder path inside the repository, without . or .. segments" };
    if (subdirectory && !source.provider.supportsSubdirectory)
      return { error: `${source.provider.name} does not support narrowing a repository to a folder` };
    const sourceResourceId = withResourceSubdirectory(input.data.sourceResourceId, subdirectory);
    const [repository, board] = await Promise.all([
      resolveResource(source.provider, source.context, sourceResourceId),
      resolveResource(tracker.provider, tracker.context, input.data.trackerResourceId),
    ]);
    if (!repository)
      return {
        error: subdirectory
          ? `That folder is not accessible in ${source.provider.name}`
          : `That ${source.provider.resourceNoun} is not accessible to ${source.provider.name}`,
      };
    if (!board) return { error: `That ${tracker.provider.resourceNoun} was not found in ${tracker.provider.name}` };

    const created = first(
      await db
        .insert(project)
        .values({
          organizationId,
          name: input.data.name,
          sourceConnectionId: source.connection.id,
          sourceResourceId: repository.id,
          sourceResourceLabel: repository.label,
          trackerConnectionId: tracker.connection.id,
          trackerResourceId: board.id,
          trackerResourceLabel: board.label,
        })
        .returning({ id: project.id }),
    );
    redirect(`/projects/${created.id}`);
  });
}

// Delete redirects on success; nothing is returned to the caller on that path.
export async function deleteProject(projectId: string): Promise<ActionState> {
  return withActionErrors(async () => {
    const { organizationId } = await requireOrgAdmin();
    await getDb()
      .delete(project)
      .where(and(eq(project.id, projectId), eq(project.organizationId, organizationId)));
    redirect("/projects");
  });
}
