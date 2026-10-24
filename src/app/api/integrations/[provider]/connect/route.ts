import { NextResponse } from "next/server";
import { providerById } from "@/features/integrations/resolve";
import { startConnect } from "@/features/integrations/oauth-flow";
import { requireOrgContext } from "@/infrastructure/auth/session";

export async function GET(request: Request, { params }: RouteContext<"/api/integrations/[provider]/connect">) {
  const provider = providerById((await params).provider);
  if (!provider) return NextResponse.json({ error: "Unknown integration" }, { status: 404 });
  const query = new URL(request.url).searchParams;
  const url = startConnect(provider, await requireOrgContext(), {
    add: query.has("add"),
    returnTo: query.get("returnTo"),
  });
  return NextResponse.redirect(url);
}
