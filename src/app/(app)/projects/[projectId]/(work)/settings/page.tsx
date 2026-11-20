import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { projectForRequest } from "@/features/projects/request";
import { requireOrgContext } from "@/infrastructure/auth/session";

export const metadata: Metadata = { title: "Project settings" };

export default async function Page({ params }: PageProps<"/projects/[projectId]/settings">) {
  const { projectId } = await params;
  const { organizationId, isAdmin } = await requireOrgContext();
  const loaded = await projectForRequest(organizationId, projectId);
  if (!loaded) notFound();
  const { project } = loaded;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Danger zone</CardTitle>
        <CardDescription>Deleting a project is permanent.</CardDescription>
      </CardHeader>
      <CardContent>
        {isAdmin ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-prose">
              <p className="font-medium">Delete this project</p>
              <p className="text-sm text-muted-foreground">
                Removes the project and its analysis history. This cannot be undone.
              </p>
            </div>
            <DeleteProjectButton projectId={project.id} name={project.name} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Only organization owners and admins can delete a project.</p>
        )}
      </CardContent>
    </Card>
  );
}
