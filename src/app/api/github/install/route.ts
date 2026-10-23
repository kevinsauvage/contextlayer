import { NextResponse } from "next/server";
import { requireOrgAdmin } from "@/infrastructure/auth/session";
import { getEnv, MissingConfigError } from "@/infrastructure/env";
import { signState } from "@/infrastructure/signed-state";
import { githubAuthorizeUrl, githubInstallUrl } from "@/integrations/github/app";

// Default: find the installations the user already has (GitHub does not call us back for an app that is
// already installed). `?add` goes straight to GitHub's install page to add another account.
export async function GET(request: Request) {
  const { userId, organizationId } = await requireOrgAdmin();
  const state = signState({ userId, organizationId });
  const addAccount = new URL(request.url).searchParams.has("add");
  try {
    return NextResponse.redirect(addAccount ? githubInstallUrl(state) : githubAuthorizeUrl(state));
  } catch (error) {
    if (!(error instanceof MissingConfigError)) throw error;
    return NextResponse.redirect(new URL("/settings/integrations?github=unconfigured", getEnv().BETTER_AUTH_URL));
  }
}
