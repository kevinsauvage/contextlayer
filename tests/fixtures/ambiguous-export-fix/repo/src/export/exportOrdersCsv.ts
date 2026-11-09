import { toCsv } from "./toCsv";

export type OrderRow = { id: string; totalCents: number };

export const exportOrdersCsv = (orders: OrderRow[]) =>
  toCsv(orders.map((order) => ({ id: order.id, total: order.totalCents / 100 })));
