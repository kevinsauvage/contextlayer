import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { E2E_DATABASE_URL } from "./database";

export default async function globalSetup() {
  const target = new URL(E2E_DATABASE_URL);
  const name = target.pathname.slice(1);
  const admin = postgres({ ...connectionOf(target), database: "postgres", max: 1, onnotice: () => undefined });
  try {
    await admin.unsafe(`drop database if exists "${name}" with (force)`);
    await admin.unsafe(`create database "${name}"`);
  } finally {
    await admin.end();
  }

  const sql = postgres(E2E_DATABASE_URL, { max: 1 });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  } finally {
    await sql.end();
  }
}

const connectionOf = (url: URL) => ({
  host: url.hostname,
  port: Number(url.port || 5432),
  username: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
});
