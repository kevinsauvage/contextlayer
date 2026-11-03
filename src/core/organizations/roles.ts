export const OWNER_ROLE = "owner";
export const ADMIN_ROLE = "admin";
export const MEMBER_ROLE = "member";

// Better Auth organization roles. Owners and admins manage the organization; members analyze and publish.
export const ROLES = [OWNER_ROLE, ADMIN_ROLE, MEMBER_ROLE] as const;
type Role = (typeof ROLES)[number];

export const ADMIN_ROLES = [OWNER_ROLE, ADMIN_ROLE] as const satisfies readonly Role[];
export const INVITABLE_ROLES = [MEMBER_ROLE, ADMIN_ROLE] as const satisfies readonly Role[];

export const isAdminRole = (role: string) => (ADMIN_ROLES as readonly string[]).includes(role);
export const isInvitableRole = (role: string): role is (typeof INVITABLE_ROLES)[number] =>
  (INVITABLE_ROLES as readonly string[]).includes(role);

export type OrgActor = { userId: string; role: string; isAdmin: boolean };
export type OrgMember = { userId: string; role: string };

// Owners manage every non-owner; admins manage members. Nobody changes their own membership through this page.
export const canChangeMemberRole = (actor: OrgActor, member: OrgMember) =>
  actor.isAdmin &&
  member.userId !== actor.userId &&
  member.role !== OWNER_ROLE &&
  (actor.role === OWNER_ROLE || member.role === MEMBER_ROLE);

export const canRemoveMember = (actor: OrgActor, member: OrgMember) =>
  actor.isAdmin && member.userId !== actor.userId && member.role !== OWNER_ROLE;
