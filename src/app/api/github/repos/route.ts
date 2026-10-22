import { NextResponse } from "next/server";
import { getGithubInstallation } from "@/features/projects/queries";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";
import { listInstallationRepos } from "@/integrations/github/app";

export async function GET(request: Request) {
  const { organizationId } = await requireOrgContext();
  const installationId = Number(new URL(request.url).searchParams.get("installationId"));
  if (!(await getGithubInstallation(getDb(), organizationId, installationId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(await listInstallationRepos(installationId));
}
