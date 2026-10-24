import type { Metadata } from "next";
import { CopyLinkButton } from "@/components/copy-button";
import { DangerZone } from "@/components/organization/danger-zone";
import { InviteForm } from "@/components/organization/invite-form";
import { MemberRoleSelect } from "@/components/organization/member-role-select";
import { CancelInvitationButton, RemoveMemberButton } from "@/components/organization/member-actions";
import { OrganizationNameForm } from "@/components/organization/organization-name-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrganization, listMembers, listPendingInvitations } from "@/features/organizations/queries";
import { MEMBER_ROLE, OWNER_ROLE, isAdminRole } from "@/core/organizations/roles";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";

export const metadata: Metadata = { title: "Organization settings" };

export default async function Page() {
  const { organizationId, userId, isAdmin, role: currentRole } = await requireOrgContext();
  const db = getDb();
  const [organization, members, invitations] = await Promise.all([
    getOrganization(db, organizationId),
    listMembers(db, organizationId),
    isAdmin ? listPendingInvitations(db, organizationId) : [],
  ]);
  // Owners manage every non-owner; admins manage members. Nobody changes their own role here.
  const canChangeRole = (member: { userId: string; role: string }) =>
    isAdmin &&
    member.userId !== userId &&
    member.role !== OWNER_ROLE &&
    (currentRole === OWNER_ROLE || member.role === MEMBER_ROLE);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Organization settings"
        description="Members and integrations are shared across the organization."
      />

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent>
          <OrganizationNameForm name={organization?.name ?? ""} canEdit={isAdmin} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Members analyze and publish tickets. Owners and admins also manage integrations, projects and members.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ul className="flex flex-col divide-y rounded-lg border">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">
                    {m.name} {m.userId === userId && <span className="text-muted-foreground">(you)</span>}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{m.email}</span>
                </div>
                {canChangeRole(m) ? (
                  <MemberRoleSelect memberId={m.id} role={m.role} />
                ) : (
                  <Badge variant={isAdminRole(m.role) ? "secondary" : "outline"} className="capitalize">
                    {m.role}
                  </Badge>
                )}
                {isAdmin && m.userId !== userId && m.role !== OWNER_ROLE && <RemoveMemberButton memberId={m.id} />}
              </li>
            ))}
          </ul>

          {isAdmin && (
            <div className="flex flex-col gap-3">
              <h3 className="font-medium">Invite a teammate</h3>
              <InviteForm />
              {invitations.length > 0 && (
                <ul className="flex flex-col divide-y rounded-lg border">
                  {invitations.map((invitation) => (
                    <li key={invitation.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{invitation.email}</span>
                        <span className="text-xs text-muted-foreground">
                          Pending · expires{" "}
                          {invitation.expiresAt.toLocaleDateString("en", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {invitation.role ?? MEMBER_ROLE}
                      </Badge>
                      <CopyLinkButton path={`/invitations/${invitation.id}`} />
                      <CancelInvitationButton invitationId={invitation.id} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>Leaving or deleting an organization is permanent.</CardDescription>
        </CardHeader>
        <CardContent>
          <DangerZone organizationName={organization?.name ?? ""} isOwner={currentRole === OWNER_ROLE} />
        </CardContent>
      </Card>
    </div>
  );
}
