"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { z } from "zod";
import { toActionError } from "@/features/errors";
import { getAuth } from "@/infrastructure/auth/auth";
import { getSession, requireOrgAdmin } from "@/infrastructure/auth/session";
import type { ActionState } from "@/lib/action-state";
import { firstIssueMessage } from "@/lib/zod";

// Organization actions may hand back the id of the row they created, so the client can finish the job.
export type OrganizationActionResult = ActionState & { organizationId?: string; invitationId?: string; email?: string };

const nameSchema = z
  .string()
  .trim()
  .min(2, "Enter a name of at least 2 characters")
  .max(100, "Keep the name under 100 characters");
const emailSchema = z.email("Enter a valid email address");
const roleSchema = z.enum(["member", "admin"]);
const idSchema = z.string().min(1, "Choose an entry");

// Better Auth throws APIError with a message meant for the person; anything else is logged and replaced.
function failure(error: unknown, fallback: string): ActionState {
  if (error instanceof APIError) return { error: error.message || fallback };
  const known = toActionError(error);
  if (known) return known;
  console.error("[organizations]", error);
  return { error: fallback };
}

const slugBase = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "org";

const isSlugTaken = (error: unknown) =>
  error instanceof APIError && error.body?.code === "ORGANIZATION_SLUG_ALREADY_TAKEN";

async function createWithUniqueSlug(name: string) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await getAuth().api.createOrganization({
        body: { name, slug: `${slugBase(name)}-${crypto.randomUUID().slice(0, 8)}` },
        headers: await headers(),
      });
    } catch (error) {
      if (attempt >= 3 || !isSlugTaken(error)) throw error;
    }
  }
}

export async function createOrganization(name: string): Promise<OrganizationActionResult> {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };
  try {
    const organization = await createWithUniqueSlug(parsed.data);
    return { organizationId: organization.id };
  } catch (error) {
    return failure(error, "Could not create the organization");
  }
}

export async function renameOrganization(name: string): Promise<ActionState> {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };
  const { organizationId } = await requireOrgAdmin();
  try {
    await getAuth().api.updateOrganization({
      body: { organizationId, data: { name: parsed.data } },
      headers: await headers(),
    });
    return {};
  } catch (error) {
    return failure(error, "Could not rename the organization");
  }
}

export async function inviteMember(email: string, role: string): Promise<OrganizationActionResult> {
  const address = emailSchema.safeParse(email.trim());
  if (!address.success) return { error: firstIssueMessage(address.error) };
  const parsedRole = roleSchema.safeParse(role);
  if (!parsedRole.success) return { error: "Choose a valid role" };
  const { organizationId } = await requireOrgAdmin();
  try {
    const invitation = await getAuth().api.createInvitation({
      body: { email: address.data, role: parsedRole.data, organizationId },
      headers: await headers(),
    });
    return { invitationId: invitation.id, email: invitation.email };
  } catch (error) {
    return failure(error, "Could not create the invitation");
  }
}

export async function removeMember(memberId: string): Promise<ActionState> {
  const parsed = idSchema.safeParse(memberId);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };
  await requireOrgAdmin();
  try {
    await getAuth().api.removeMember({ body: { memberIdOrEmail: parsed.data }, headers: await headers() });
    return {};
  } catch (error) {
    return failure(error, "Could not remove the member");
  }
}

export async function cancelInvitation(invitationId: string): Promise<ActionState> {
  const parsed = idSchema.safeParse(invitationId);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };
  await requireOrgAdmin();
  try {
    await getAuth().api.cancelInvitation({ body: { invitationId: parsed.data }, headers: await headers() });
    return {};
  } catch (error) {
    return failure(error, "Could not cancel the invitation");
  }
}

export async function acceptInvitation(invitationId: string): Promise<OrganizationActionResult> {
  const parsed = idSchema.safeParse(invitationId);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };
  try {
    const session = await getSession();
    if (!session) return { error: "Sign in to respond to the invitation" };
    const invitation = await getAuth().api.acceptInvitation({
      body: { invitationId: parsed.data },
      headers: await headers(),
    });
    return { organizationId: invitation.invitation.organizationId };
  } catch (error) {
    return failure(error, "Could not accept the invitation");
  }
}

export async function rejectInvitation(invitationId: string): Promise<ActionState> {
  const parsed = idSchema.safeParse(invitationId);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };
  try {
    const session = await getSession();
    if (!session) return { error: "Sign in to respond to the invitation" };
    await getAuth().api.rejectInvitation({ body: { invitationId: parsed.data }, headers: await headers() });
    return {};
  } catch (error) {
    return failure(error, "Could not decline the invitation");
  }
}
