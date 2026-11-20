import { desc } from "drizzle-orm";
import { db } from "../db/client";
import { invoices, type Invoice } from "./schema";

export async function listInvoices(): Promise<Invoice[]> {
  return db.select().from(invoices).orderBy(desc(invoices.createdAt));
}
