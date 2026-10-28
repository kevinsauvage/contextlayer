import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { getProject } from "@/features/projects/queries";
import { createTicketAnalysis } from "@/features/ticket-creation/actions";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";

export const maxDuration = 300;

export const metadata: Metadata = { title: "Draft a ticket" };

export default async function Page({ params }: PageProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  const { organizationId } = await requireOrgContext();
  const project = await getProject(getDb(), organizationId, projectId);
  if (!project) notFound();

  return (
    <ActionForm
      action={createTicketAnalysis.bind(null, project.id)}
      name="request"
      title="Draft a ticket"
      description="Describe what you need, in a line or a few paragraphs: what should change, where, why, and any constraints. ContextLayer reads the code and drafts the ticket."
      placeholder={'Change the home page hero heading to "Hello, I\'m Kévin".\nKeep the gradient on the second line.'}
      multiline
      submitLabel="Draft ticket"
      pendingLabel="Drafting…"
    />
  );
}
