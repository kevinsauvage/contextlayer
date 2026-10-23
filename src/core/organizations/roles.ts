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
