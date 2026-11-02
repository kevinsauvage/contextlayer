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
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
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
      <aside className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        <h2 className="font-medium text-foreground">A request that drafts well</h2>
        <p>Name the screen or flow and the change you want.</p>
        <p>Give the constraint that matters when there is one: copy, accessibility, where it must not apply.</p>
        <p>Leave product decisions open. The draft asks instead of guessing, and regenerates when you answer.</p>
      </aside>
    </div>
  );
}
