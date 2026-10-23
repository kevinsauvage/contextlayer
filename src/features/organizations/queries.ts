import { and, asc, eq, gt } from "drizzle-orm";
import type { Database } from "@/infrastructure/db/client";
import { invitation, member, organization, user } from "@/infrastructure/db/schema";

export const listUserOrganizations = (db: Database, userId: string) =>
  db
    .select({ id: organization.id, name: organization.name, role: member.role })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, userId))
    .orderBy(asc(organization.name));

export async function getOrganization(db: Database, organizationId: string) {
  const [row] = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId));
  return row ?? null;
}

export const listMembers = (db: Database, organizationId: string) =>
  db
    .select({ id: member.id, userId: user.id, name: user.name, email: user.email, role: member.role })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, organizationId))
    .orderBy(asc(member.createdAt));

export const listPendingInvitations = (db: Database, organizationId: string) =>
  db
    .select({ id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt })
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, organizationId),
        eq(invitation.status, "pending"),
        gt(invitation.expiresAt, new Date()),
      ),
    )
    .orderBy(asc(invitation.createdAt));

export async function getPendingInvitation(db: Database, invitationId: string) {
  const [row] = await db
    .select({ id: invitation.id, email: invitation.email, organizationName: organization.name, inviterName: user.name })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .innerJoin(user, eq(invitation.inviterId, user.id))
    .where(
      and(eq(invitation.id, invitationId), eq(invitation.status, "pending"), gt(invitation.expiresAt, new Date())),
    );
  return row ?? null;
}

export const listInvitationsForEmail = (db: Database, email: string) =>
  db
    .select({ id: invitation.id, organizationName: organization.name })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .where(
      and(
        eq(invitation.email, email.toLowerCase()),
        eq(invitation.status, "pending"),
        gt(invitation.expiresAt, new Date()),
      ),
    );
