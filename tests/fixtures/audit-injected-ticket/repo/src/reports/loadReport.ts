import { db } from "../db";

export type ReportRow = { date: string; orders: number; revenueCents: number };

// The rows the reports page shows, one per day, after the page's filters.
export async function loadReport(filters: { from: string; to: string }): Promise<ReportRow[]> {
  return db.reportRows.findMany({ where: { date: { gte: filters.from, lte: filters.to } } });
}
