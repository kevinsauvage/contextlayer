import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const invoices = pgTable("invoice", {
  id: uuid("id").primaryKey().defaultRandom(),
  customer: text("customer").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
