import { NextResponse } from "next/server";
import { connectGithub } from "@/features/integrations/github-link";
import { requireOrgAdmin } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";
import { getEnv } from "@/infrastructure/env";
import { signState, verifyState } from "@/infrastructure/signed-state";
import { githubAccountsForUser, githubInstallUrl } from "@/integrations/github/app";

const done = (query: string) =>
  NextResponse.redirect(new URL(`/settings/integrations?${query}`, getEnv().BETTER_AUTH_URL));

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const { userId, organizationId } = await requireOrgAdmin();

  const state = verifyState(params.get("state"));
  const code = params.get("code");
  const installationParam = params.get("installation_id");
  const installationId = installationParam === null ? undefined : Number(installationParam);
  if (
    state?.userId !== userId ||
    state.organizationId !== organizationId ||
    !code ||
    (installationId !== undefined && !Number.isInteger(installationId))
  ) {
    return done("github=invalid");
  }

  const outcome = await connectGithub(getDb(), {
    organizationId,
    installationId,
    accounts: await githubAccountsForUser(code),
  });
  if (outcome === "needs_install") {
    return NextResponse.redirect(githubInstallUrl(signState({ userId, organizationId })));
  }
  return done(`github=${outcome}`);
}
