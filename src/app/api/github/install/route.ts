import { NextResponse } from "next/server";
import { requireOrgAdmin } from "@/infrastructure/auth/session";
import { getEnv, MissingConfigError } from "@/infrastructure/env";
import { signState } from "@/infrastructure/signed-state";
import { githubInstallUrl } from "@/integrations/github/app";

export async function GET() {
  const { userId, organizationId } = await requireOrgAdmin();
  try {
    return NextResponse.redirect(githubInstallUrl(signState({ userId, organizationId })));
  } catch (error) {
    if (!(error instanceof MissingConfigError)) throw error;
    return NextResponse.redirect(new URL("/settings/integrations?github=unconfigured", getEnv().BETTER_AUTH_URL));
  }
}
