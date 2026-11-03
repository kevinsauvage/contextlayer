import { describe, expect, it } from "vitest";
import {
  ADMIN_ROLE,
  ADMIN_ROLES,
  MEMBER_ROLE,
  OWNER_ROLE,
  ROLES,
  canChangeMemberRole,
  canRemoveMember,
  isAdminRole,
  isInvitableRole,
} from "@/core/organizations/roles";

const actor = (role: string, userId = "me") => ({ userId, role, isAdmin: isAdminRole(role) });
const member = (role: string, userId = "other") => ({ userId, role });

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

  it("lets owners change any non-owner and admins change members", () => {
    expect(canChangeMemberRole(actor(OWNER_ROLE), member(ADMIN_ROLE))).toBe(true);
    expect(canChangeMemberRole(actor(OWNER_ROLE), member(MEMBER_ROLE))).toBe(true);
    expect(canChangeMemberRole(actor(ADMIN_ROLE), member(MEMBER_ROLE))).toBe(true);
    expect(canChangeMemberRole(actor(ADMIN_ROLE), member(ADMIN_ROLE))).toBe(false);
    expect(canChangeMemberRole(actor(MEMBER_ROLE), member(MEMBER_ROLE))).toBe(false);
  });

  it("never changes or removes your own membership or an owner", () => {
    expect(canChangeMemberRole(actor(OWNER_ROLE), member(MEMBER_ROLE, "me"))).toBe(false);
    expect(canRemoveMember(actor(OWNER_ROLE), member(OWNER_ROLE))).toBe(false);
    expect(canRemoveMember(actor(MEMBER_ROLE), member(MEMBER_ROLE))).toBe(false);
  });

  it("lets an admin remove another admin but not an owner", () => {
    expect(canRemoveMember(actor(ADMIN_ROLE), member(ADMIN_ROLE))).toBe(true);
    expect(canRemoveMember(actor(ADMIN_ROLE), member(OWNER_ROLE))).toBe(false);
    expect(canRemoveMember(actor(OWNER_ROLE), member(ADMIN_ROLE))).toBe(true);
  });
});
