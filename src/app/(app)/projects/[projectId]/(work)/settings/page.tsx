import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { getProject } from "@/features/projects/queries";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";

export const metadata: Metadata = { title: "Project settings" };

export default async function Page({ params }: PageProps<"/projects/[projectId]/settings">) {
  const { projectId } = await params;
  const { organizationId, isAdmin } = await requireOrgContext();
  const project = await getProject(getDb(), organizationId, projectId);
  if (!project) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      {isAdmin ? (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-destructive/30 p-4">
          <div>
            <h2 className="font-medium">Delete project</h2>
            <p className="text-sm text-muted-foreground">
              Removes the project and its analysis history. This cannot be undone.
            </p>
          </div>
          <DeleteProjectButton projectId={project.id} name={project.name} />
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Only organization owners and admins can delete a project.</p>
      )}
    </div>
  );
}
