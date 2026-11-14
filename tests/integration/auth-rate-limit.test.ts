import { beforeAll, describe, expect, it, vi } from "vitest";
import { getAuth } from "@/infrastructure/auth/auth";
import type { Database } from "@/infrastructure/db/client";
import * as schema from "@/infrastructure/db/schema";
import { migratedDb } from "../helpers/db";

const state = vi.hoisted(() => ({ db: undefined as unknown as Database }));

vi.mock("@/infrastructure/db/client", () => ({ getDb: () => state.db }));

const nextHeaders = vi.hoisted(() => () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));
vi.mock("next/headers", nextHeaders);
vi.mock("next/headers.js", nextHeaders);

const headers = new Headers({ "x-forwarded-for": "203.0.113.7" });

const post = (path: string, body: unknown) =>
  getAuth().handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: "POST",
      headers: { ...Object.fromEntries(headers), "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeAll(async () => {
  state.db = await migratedDb();
});

describe("database rate limiting", () => {
  it("refuses more than three sign-in attempts in the ten-second window", async () => {
    const email = "limited@x.test";
    await post("/sign-up/email", { email, password: "password-1234", name: "Limited" });

    const attempts = await Promise.all(
      Array.from({ length: 4 }, () => post("/sign-in/email", { email, password: "password-1234" })),
    );

    const statuses = attempts.map((response) => response.status).sort();
    expect(statuses).toEqual([200, 200, 200, 429]);

    const rows = await state.db.select({ key: schema.rateLimit.key }).from(schema.rateLimit);
    expect(rows.some((row) => row.key.includes("/sign-in"))).toBe(true);
  });
});
