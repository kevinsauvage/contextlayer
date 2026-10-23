import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AcceptInvitation } from "@/components/organization/accept-invitation";
import { CenteredShell } from "@/components/layout/centered-shell";
import { SwitchAccountButton } from "@/components/auth/switch-account-button";
import { getPendingInvitation } from "@/features/organizations/queries";
import { getSession } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";

export const metadata: Metadata = { title: "Invitation" };

export default async function Page({ params }: PageProps<"/invitations/[invitationId]">) {
  const { invitationId } = await params;
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(`/invitations/${invitationId}`)}`);
  const invitation = await getPendingInvitation(getDb(), invitationId);

  if (!invitation) {
    return (
      <CenteredShell title="Invitation unavailable" description="It was already used, cancelled, or has expired.">
        <Link href="/projects" className="text-sm underline">
          Go to ContextLayer
        </Link>
      </CenteredShell>
    );
  }

  const forSomeoneElse = invitation.email.toLowerCase() !== session.user.email.toLowerCase();
  return (
    <CenteredShell
      title={`Join ${invitation.organizationName}`}
      description={`${invitation.inviterName} invited ${invitation.email}.`}
    >
      {forSomeoneElse ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            You are signed in as {session.user.email}. Sign in with {invitation.email} to accept this invitation.
          </p>
          <SwitchAccountButton next={`/invitations/${invitation.id}`} />
        </div>
      ) : (
        <AcceptInvitation invitationId={invitation.id} />
      )}
    </CenteredShell>
  );
}
