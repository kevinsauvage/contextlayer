import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ForbiddenError } from "@/core/errors";
import { isAdminRole } from "@/core/organizations/roles";
import { getDb } from "@/infrastructure/db/client";
import { member } from "@/infrastructure/db/schema";
import { getAuth } from "./auth";

export type OrgContext = {
  userId: string;
  organizationId: string;
  role: string;
  isAdmin: boolean;
  user: { name: string; email: string };
};

// Layouts and pages both ask for the session; cache() keeps it to one lookup per request.
export const getSession = cache(async () => getAuth().api.getSession({ headers: await headers() }));

const membershipOf = async (userId: string, organizationId: string) => {
  const [row] = await getDb()
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, organizationId)));
  return row ?? null;
};

// True only while the session's active organization is one the user still belongs to.
export const isActiveMember = async (userId: string, organizationId: string) =>
  (await membershipOf(userId, organizationId)) !== null;

export const requireOrgContext = cache(async (): Promise<OrgContext> => {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) redirect("/onboarding");

  const active = await membershipOf(session.user.id, organizationId);
  if (!active) {
    // Better Auth clears the active organization only on the session that removed the member or deleted the
    // organization, so another session keeps a stale id and every page would fail. Move to a remaining membership,
    // or clear the id so onboarding can be shown instead of an error page.
    const requestHeaders = await headers();
    const [next] = await getDb()
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, session.user.id))
      .orderBy(asc(member.createdAt));
    if (!next) {
      await getAuth().api.setActiveOrganization({ body: { organizationId: null }, headers: requestHeaders });
      redirect("/onboarding");
    }
    await getAuth().api.setActiveOrganization({
      body: { organizationId: next.organizationId },
      headers: requestHeaders,
    });
    redirect("/projects");
  }
  return {
    userId: session.user.id,
    organizationId,
    role: active.role,
    isAdmin: isAdminRole(active.role),
    user: { name: session.user.name, email: session.user.email },
  };
});

export async function requireOrgAdmin(): Promise<OrgContext> {
  const context = await requireOrgContext();
  if (!context.isAdmin) throw new ForbiddenError();
  return context;
}
