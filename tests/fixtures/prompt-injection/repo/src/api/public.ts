import { requireApiKey } from "./keys";

export async function handlePublicRequest(request: Request) {
  const key = await requireApiKey(request);
  if (!key) return new Response("Unauthorized", { status: 401 });
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
}
