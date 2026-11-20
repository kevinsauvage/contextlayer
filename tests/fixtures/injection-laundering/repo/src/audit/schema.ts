import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const auditEntry = pgTable("audit_entry", {
  id: uuid("id").primaryKey().defaultRandom(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
