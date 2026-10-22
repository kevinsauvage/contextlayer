import { toCsv } from "../lib/csv";

export async function exportUsersCsv() {
  const users = await db.users.findMany();
  return toCsv(users, ["id", "email", "createdAt"]);
}
