import { orders } from "../orders/repository";
import { sendMail } from "../mail/send";
import { toCsv } from "./toCsv";

export async function exportOrdersCsv(userId: string, email: string) {
  const rows = await orders.forUser(userId);
  const body = toCsv(rows);
  await sendMail(email, "Your orders", body);
  return { rows: rows.length };
}
