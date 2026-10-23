import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";

export type OrgContext = { userId: string; organizationId: string; role: string };

const ADMIN_ROLES = new Set(["owner", "admin"]);

export async function getSession() {
  return getAuth().api.getSession({ headers: await headers() });
}

export async function requireOrgContext(): Promise<OrgContext> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) redirect("/onboarding");

  // Not a member answers null with a 400, which the endpoint's declared return type omits.
  const member = (await getAuth().api.getActiveMember({ headers: await headers() })) as { role: string } | null;
  if (!member) redirect("/onboarding");
  return { userId: session.user.id, organizationId, role: member.role };
}

export async function requireOrgAdmin(): Promise<OrgContext> {
  const context = await requireOrgContext();
  if (!ADMIN_ROLES.has(context.role)) throw new Error("Only organization owners and admins can do this");
  return context;
}
