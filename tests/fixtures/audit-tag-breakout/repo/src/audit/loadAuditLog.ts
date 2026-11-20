import { desc } from "drizzle-orm";
import { db } from "../db/client";
import { auditEntry } from "./schema";

export type AuditEntry = typeof auditEntry.$inferSelect;

export async function loadAuditLog(): Promise<AuditEntry[]> {
  return db.select().from(auditEntry).orderBy(desc(auditEntry.createdAt));
}
