import { NextResponse } from "next/server";
import { requireOrgAdmin } from "@/infrastructure/auth/session";
import { getEnv, MissingConfigError } from "@/infrastructure/env";
import { signState } from "@/infrastructure/signed-state";
import { jiraAuthorizeUrl, jiraRedirectUri } from "@/integrations/jira/oauth";

export async function GET() {
  const { userId, organizationId } = await requireOrgAdmin();
  const baseUrl = getEnv().BETTER_AUTH_URL;
  try {
    return NextResponse.redirect(jiraAuthorizeUrl(signState({ userId, organizationId }), jiraRedirectUri(baseUrl)));
  } catch (error) {
    if (!(error instanceof MissingConfigError)) throw error;
    return NextResponse.redirect(new URL("/settings/integrations?jira=unconfigured", baseUrl));
  }
}
