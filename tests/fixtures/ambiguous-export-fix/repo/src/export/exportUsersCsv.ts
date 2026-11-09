import { toCsv } from "./toCsv";

export type UserRow = { id: string; email: string };

export const exportUsersCsv = (users: UserRow[]) =>
  toCsv(users.map((user) => ({ id: user.id, email: user.email })));
