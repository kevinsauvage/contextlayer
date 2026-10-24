import { NextResponse } from "next/server";
import { providerById } from "@/features/integrations/resolve";
import { finishConnect } from "@/features/integrations/oauth-flow";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";

export async function GET(request: Request, { params }: RouteContext<"/api/integrations/[provider]/callback">) {
  const provider = providerById((await params).provider);
  if (!provider) return NextResponse.json({ error: "Unknown integration" }, { status: 404 });
  const url = await finishConnect(getDb(), provider, await requireOrgContext(), new URL(request.url).searchParams);
  return NextResponse.redirect(url);
}
