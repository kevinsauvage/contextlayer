import { NextResponse } from "next/server";
import { jiraAccessToken } from "@/features/integrations/jira-access";
import { getJiraConnection } from "@/features/projects/queries";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";
import { listJiraProjects } from "@/integrations/jira/client";

export async function GET(request: Request) {
  const { organizationId } = await requireOrgContext();
  const db = getDb();
  const connection = await getJiraConnection(db, organizationId, new URL(request.url).searchParams.get("connectionId") ?? "");
  if (!connection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await listJiraProjects(connection, await jiraAccessToken(db, connection)));
}
