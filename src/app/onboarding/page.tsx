import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CenteredShell } from "@/components/layout/centered-shell";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { buttonVariants } from "@/components/ui/button";
import { listInvitationsForUser } from "@/features/organizations/queries";
import { getSession, isActiveMember } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";

export const metadata: Metadata = { title: "Welcome" };

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  // A stale active organization points at one the user has left: onboarding must not bounce them back to /projects.
  if (
    session.session.activeOrganizationId &&
    (await isActiveMember(session.user.id, session.session.activeOrganizationId))
  )
    redirect("/projects");
  const invitations = await listInvitationsForUser(getDb(), session.user);

  return (
    <CenteredShell
      title="Create your organization"
      description="Your team, integrations and projects live in an organization."
    >
      {invitations.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <p className="font-medium">You have been invited</p>
          {invitations.map((invitation) => (
            <div key={invitation.id} className="flex items-center justify-between gap-2">
              <span className="truncate">{invitation.organizationName}</span>
              <Link href={`/invitations/${invitation.id}`} className={buttonVariants({ size: "sm" })}>
                View invitation
              </Link>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Or create your own organization below.</p>
        </div>
      )}
      <OnboardingForm />
    </CenteredShell>
  );
}
