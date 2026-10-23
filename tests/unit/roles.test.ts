import { describe, expect, it } from "vitest";
import {
  ADMIN_ROLE,
  ADMIN_ROLES,
  MEMBER_ROLE,
  OWNER_ROLE,
  ROLES,
  isAdminRole,
  isInvitableRole,
} from "@/core/organizations/roles";

describe("organization roles", () => {
  it("treats owners and admins as admins", () => {
    expect(ADMIN_ROLES).toEqual([OWNER_ROLE, ADMIN_ROLE]);
    expect(ROLES.filter((role) => isAdminRole(role))).toEqual([OWNER_ROLE, ADMIN_ROLE]);
    expect(isAdminRole(MEMBER_ROLE)).toBe(false);
    expect(isAdminRole("guest")).toBe(false);
  });

  it("only invites members and admins", () => {
    expect(ROLES.filter((role) => isInvitableRole(role))).toEqual([ADMIN_ROLE, MEMBER_ROLE]);
    expect(isInvitableRole(OWNER_ROLE)).toBe(false);
    expect(isInvitableRole("guest")).toBe(false);
  });
});
