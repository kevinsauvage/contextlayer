import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuth } from "./auth";

export type OrgContext = {
  userId: string;
  organizationId: string;
  role: string;
  isAdmin: boolean;
  user: { name: string; email: string };
};

const ADMIN_ROLES = new Set(["owner", "admin"]);

// Layouts and pages both ask for the session; cache() keeps it to one lookup per request.
export const getSession = cache(async () => getAuth().api.getSession({ headers: await headers() }));

export const requireOrgContext = cache(async (): Promise<OrgContext> => {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) redirect("/onboarding");

  // Not a member answers null with a 400, which the endpoint's declared return type omits.
  const member = (await getAuth().api.getActiveMember({ headers: await headers() })) as { role: string } | null;
  if (!member) redirect("/onboarding");
  return {
    userId: session.user.id,
    organizationId,
    role: member.role,
    isAdmin: ADMIN_ROLES.has(member.role),
    user: { name: session.user.name, email: session.user.email },
  };
});

export async function requireOrgAdmin(): Promise<OrgContext> {
  const context = await requireOrgContext();
  if (!context.isAdmin) throw new Error("Only organization owners and admins can do this");
  return context;
}
