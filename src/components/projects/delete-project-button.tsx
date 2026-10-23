"use client";

import { ConfirmButton } from "@/components/confirm-button";
import { deleteProject } from "@/features/projects/actions";

export function DeleteProjectButton({ projectId, name }: { projectId: string; name: string }) {
  return (
    <ConfirmButton
      trigger="Delete project"
      triggerVariant="destructive"
      title={`Delete ${name}?`}
      description="Its analysis history is deleted too. Tickets already published stay in the issue tracker."
      confirmLabel="Delete project"
      pendingLabel="Deleting…"
      action={() => deleteProject(projectId)}
    />
  );
}
