import { NextResponse } from "next/server";
import { requireOrgAdmin } from "@/infrastructure/auth/session";
import { encrypt } from "@/infrastructure/crypto";
import { getDb } from "@/infrastructure/db/client";
import { jiraConnection } from "@/infrastructure/db/schema";
import { getEnv } from "@/infrastructure/env";
import { verifyState } from "@/infrastructure/signed-state";
import { exchangeJiraCode, jiraRedirectUri, listJiraSites } from "@/integrations/jira/oauth";

const done = (query: string) => NextResponse.redirect(new URL(`/settings/integrations?${query}`, getEnv().BETTER_AUTH_URL));

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const { userId, organizationId } = await requireOrgAdmin();

  const state = verifyState(params.get("state"));
  const code = params.get("code");
  if (state?.userId !== userId || state.organizationId !== organizationId || !code) return done("jira=invalid");

  const tokens = await exchangeJiraCode(code, jiraRedirectUri(getEnv().BETTER_AUTH_URL));
  const sites = await listJiraSites(tokens.accessToken);
  const credentials = {
    accessTokenEnc: encrypt(tokens.accessToken),
    refreshTokenEnc: encrypt(tokens.refreshToken),
    expiresAt: tokens.expiresAt,
    connectedByUserId: userId,
  };

  await Promise.all(
    sites.map((site) =>
      getDb()
        .insert(jiraConnection)
        .values({ organizationId, cloudId: site.id, siteUrl: site.url, siteName: site.name, ...credentials })
        .onConflictDoUpdate({ target: [jiraConnection.organizationId, jiraConnection.cloudId], set: credentials }),
    ),
  );
  return done("jira=connected");
}
