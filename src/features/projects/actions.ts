"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Resource } from "@/core/integrations/provider";
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
  trackerConnectionId: z.uuid("Choose where tickets live"),
  trackerResourceId: z.string().min(1, "Choose a project or board"),
});

const findResource = (resources: Resource[], id: string) => resources.find((resource) => resource.id === id);

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
    const [sources, trackers] = await Promise.all([
      source.provider.listResources(source.context),
      tracker.provider.listResources(tracker.context),
    ]);
    const repository = findResource(sources, input.data.sourceResourceId);
    const board = findResource(trackers, input.data.trackerResourceId);
    if (!repository)
      return { error: `That ${source.provider.resourceNoun} is not accessible to ${source.provider.name}` };
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

export async function deleteProject(projectId: string): Promise<ActionState> {
  return withActionErrors(async () => {
    const { organizationId } = await requireOrgAdmin();
    await getDb()
      .delete(project)
      .where(and(eq(project.id, projectId), eq(project.organizationId, organizationId)));
    redirect("/projects");
  });
}
