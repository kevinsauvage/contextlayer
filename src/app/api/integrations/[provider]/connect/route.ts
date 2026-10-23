import { NextResponse } from "next/server";
import { startConnect } from "@/features/integrations/oauth-flow";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { findProvider } from "@/integrations/registry";

export async function GET(request: Request, { params }: RouteContext<"/api/integrations/[provider]/connect">) {
  const provider = findProvider((await params).provider);
  if (!provider) return NextResponse.json({ error: "Unknown integration" }, { status: 404 });
  const query = new URL(request.url).searchParams;
  const url = startConnect(provider, await requireOrgContext(), {
    add: query.has("add"),
    returnTo: query.get("returnTo"),
  });
  return NextResponse.redirect(url);
}
