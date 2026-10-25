import { db } from "../db";

const PAGE_SIZE = 20;

// GET /api/orders?page=N — the page size is fixed; other query parameters are ignored.
export async function listOrders(request: Request) {
  const page = Math.max(1, Number(new URL(request.url).searchParams.get("page") ?? "1"));
  const orders = await db.orders.findMany({ skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE });
  return Response.json({ page, orders });
}
