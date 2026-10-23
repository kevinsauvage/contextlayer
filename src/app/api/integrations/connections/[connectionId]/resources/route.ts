import { NextResponse } from "next/server";
import { listConnectionResources } from "@/features/integrations/resources";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";

export async function GET(
  _: Request,
  { params }: RouteContext<"/api/integrations/connections/[connectionId]/resources">,
) {
  const { organizationId } = await requireOrgContext();
  const result = await listConnectionResources(getDb(), organizationId, (await params).connectionId);
  return "error" in result
    ? NextResponse.json({ error: result.error }, { status: result.status })
    : NextResponse.json(result.resources);
}
