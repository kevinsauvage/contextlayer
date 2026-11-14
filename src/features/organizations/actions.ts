"use server";

import { APIError } from "better-auth/api";
import type { Route } from "next";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { and, eq } from "drizzle-orm";
import pRetry from "p-retry";
import slugify from "slugify";
import { z } from "zod";
import {
  INVITABLE_ROLES,
  OWNER_ROLE,
  canChangeMemberRole,
  canRemoveMember,
  type OrgActor,
  type OrgMember,
} from "@/core/organizations/roles";
import { organizationNameSchema } from "@/core/organizations/schemas";
import { toActionError } from "@/features/errors";
import { getAuth } from "@/infrastructure/auth/auth";
import { getSession, requireOrgAdmin, requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";
import { member } from "@/infrastructure/db/schema";
import type { ActionState } from "@/lib/action-state";
import { firstIssueMessage } from "@/lib/zod";
import { listUserOrganizations } from "./queries";

// Organization actions may hand back the id of the row they created, so the client can finish the job.
export type OrganizationActionResult = ActionState & { organizationId?: string; invitationId?: string; email?: string };

const emailSchema = z.email("Enter a valid email address");
const roleSchema = z.enum(INVITABLE_ROLES);
const idSchema = z.string().min(1, "Choose an entry");

// Better Auth throws APIError with a message meant for the person; anything else is logged and replaced.
function failure(error: unknown, fallback: string): ActionState {
  // A sign-in redirect from the role check must still navigate.
  unstable_rethrow(error);
  if (error instanceof APIError) return { error: error.message || fallback };
  const known = toActionError(error);
  if (known) return known;
  console.error("[organizations]", error);
  return { error: fallback };
}

// Every action below has the same shape: run the Better Auth call, map a thrown error to a message for the person.
async function authAction<T extends object>(fallback: string, run: () => Promise<T>): Promise<T | ActionState> {
  try {
    return await run();
  } catch (error) {
    return failure(error, fallback);
  }
}

type ParsedId = { value: string } | { error: string };

function parseId(value: string): ParsedId {
  const parsed = idSchema.safeParse(value);
  return parsed.success ? { value: parsed.data } : { error: firstIssueMessage(parsed.error) };
}

// Slugs carry a random suffix and are never parsed back, so the package's stricter transliteration is safe.
const slugBase = (name: string) => slugify(name, { lower: true, strict: true }).slice(0, 40) || "org";

const isSlugTaken = (error: unknown) =>
  error instanceof APIError && error.body?.code === "ORGANIZATION_SLUG_ALREADY_TAKEN";

const createWithUniqueSlug = async (name: string) =>
  pRetry(
    async () =>
      getAuth().api.createOrganization({
        body: { name, slug: `${slugBase(name)}-${crypto.randomUUID().slice(0, 8)}` },
        headers: await headers(),
      }),
    { retries: 2, minTimeout: 0, shouldRetry: ({ error }) => isSlugTaken(error) },
  );

export async function createOrganization(name: string): Promise<OrganizationActionResult> {
  const parsed = organizationNameSchema.safeParse(name);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };
  return authAction("Could not create the organization", async () => {
    const organization = await createWithUniqueSlug(parsed.data);
    return { organizationId: organization.id };
  });
}

export async function renameOrganization(name: string): Promise<ActionState> {
  const parsed = organizationNameSchema.safeParse(name);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };
  return authAction("Could not rename the organization", async () => {
    const { organizationId } = await requireOrgAdmin();
    await getAuth().api.updateOrganization({
      body: { organizationId, data: { name: parsed.data } },
      headers: await headers(),
    });
    return {};
  });
}

export async function inviteMember(email: string, role: string): Promise<OrganizationActionResult> {
  const address = emailSchema.safeParse(email.trim());
  if (!address.success) return { error: firstIssueMessage(address.error) };
  const parsedRole = roleSchema.safeParse(role);
  if (!parsedRole.success) return { error: "Choose a valid role" };
  return authAction("Could not create the invitation", async () => {
    const { organizationId } = await requireOrgAdmin();
    const invitation = await getAuth().api.createInvitation({
      body: { email: address.data, role: parsedRole.data, organizationId },
      headers: await headers(),
    });
    return { invitationId: invitation.id, email: invitation.email };
  });
}

// The page hides what the role rules forbid; a direct call to the action has to meet the same rules, which are
// stricter than Better Auth's own (an admin there may change another admin).
async function refusal(
  memberId: string,
  allowed: (actor: OrgActor, target: OrgMember) => boolean,
  message: string,
): Promise<ActionState | null> {
  const actor = await requireOrgAdmin();
  const [target] = await getDb()
    .select({ userId: member.userId, role: member.role })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, actor.organizationId)));
  if (!target) return { error: "Member not found" };
  return allowed(actor, target) ? null : { error: message };
}

export async function removeMember(memberId: string): Promise<ActionState> {
  const id = parseId(memberId);
  if ("error" in id) return id;
  return authAction("Could not remove the member", async () => {
    const refused = await refusal(id.value, canRemoveMember, "You cannot remove this member");
    if (refused) return refused;
    await getAuth().api.removeMember({ body: { memberIdOrEmail: id.value }, headers: await headers() });
    return {};
  });
}

export async function updateMemberRole(memberId: string, role: string): Promise<ActionState> {
  const id = parseId(memberId);
  if ("error" in id) return id;
  const parsedRole = roleSchema.safeParse(role);
  if (!parsedRole.success) return { error: "Choose a valid role" };
  return authAction("Could not change the member role", async () => {
    const refused = await refusal(id.value, canChangeMemberRole, "You cannot change this member's role");
    if (refused) return refused;
    await getAuth().api.updateMemberRole({
      body: { memberId: id.value, role: parsedRole.data },
      headers: await headers(),
    });
    return {};
  });
}

// After leaving or deleting the active organization, land on another membership instead of onboarding jail.
async function nextOrganizationPath(userId: string): Promise<Route> {
  const [next] = await listUserOrganizations(getDb(), userId);
  if (!next) return "/onboarding";
  try {
    await getAuth().api.setActiveOrganization({
      body: { organizationId: next.id },
      headers: await headers(),
    });
    return "/projects";
  } catch (error) {
    console.error("[organizations] could not activate the next organization", error);
    return "/onboarding";
  }
}

// The redirect after a successful leave or delete stays outside the wrapper: it is navigation, not an outcome.
export async function leaveOrganization(): Promise<ActionState> {
  const { organizationId, userId } = await requireOrgContext();
  const result = await authAction<ActionState>("Could not leave the organization", async () => {
    await getAuth().api.leaveOrganization({ body: { organizationId }, headers: await headers() });
    return {};
  });
  if (result.error) return result;
  redirect(await nextOrganizationPath(userId));
}

export async function deleteOrganization(): Promise<ActionState> {
  const { organizationId, userId, role } = await requireOrgContext();
  if (role !== OWNER_ROLE) return { error: "Only the organization owner can delete it" };
  const result = await authAction<ActionState>("Could not delete the organization", async () => {
    await getAuth().api.deleteOrganization({ body: { organizationId }, headers: await headers() });
    return {};
  });
  if (result.error) return result;
  redirect(await nextOrganizationPath(userId));
}

export async function cancelInvitation(invitationId: string): Promise<ActionState> {
  const id = parseId(invitationId);
  if ("error" in id) return id;
  return authAction("Could not cancel the invitation", async () => {
    await requireOrgAdmin();
    await getAuth().api.cancelInvitation({ body: { invitationId: id.value }, headers: await headers() });
    return {};
  });
}

export async function acceptInvitation(invitationId: string): Promise<OrganizationActionResult> {
  const id = parseId(invitationId);
  if ("error" in id) return id;
  return authAction("Could not accept the invitation", async () => {
    const session = await getSession();
    if (!session) return { error: "Sign in to respond to the invitation" };
    const invitation = await getAuth().api.acceptInvitation({
      body: { invitationId: id.value },
      headers: await headers(),
    });
    return { organizationId: invitation.invitation.organizationId };
  });
}

export async function rejectInvitation(invitationId: string): Promise<ActionState> {
  const id = parseId(invitationId);
  if ("error" in id) return id;
  return authAction("Could not decline the invitation", async () => {
    const session = await getSession();
    if (!session) return { error: "Sign in to respond to the invitation" };
    await getAuth().api.rejectInvitation({ body: { invitationId: id.value }, headers: await headers() });
    return {};
  });
}
