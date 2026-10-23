import { NextResponse } from "next/server";
import { requireOrgAdmin } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";
import { githubInstallation } from "@/infrastructure/db/schema";
import { getEnv } from "@/infrastructure/env";
import { verifyState } from "@/infrastructure/signed-state";
import { installationAccountForUser } from "@/integrations/github/app";

const done = (query: string) =>
  NextResponse.redirect(new URL(`/settings/integrations?${query}`, getEnv().BETTER_AUTH_URL));

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const { userId, organizationId } = await requireOrgAdmin();

  const state = verifyState(params.get("state"));
  const installationId = Number(params.get("installation_id"));
  const code = params.get("code");
  if (
    state?.userId !== userId ||
    state.organizationId !== organizationId ||
    !Number.isInteger(installationId) ||
    !code
  ) {
    return done("github=invalid");
  }

  const accountLogin = await installationAccountForUser(code, installationId);
  if (!accountLogin) return done("github=forbidden");

  await getDb()
    .insert(githubInstallation)
    .values({ id: installationId, organizationId, accountLogin })
    .onConflictDoNothing();
  return done("github=connected");
}
