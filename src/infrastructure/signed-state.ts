import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getEnv } from "@/infrastructure/env";

const TTL_MS = 10 * 60 * 1000;

const payloadSchema = z.object({ userId: z.string(), organizationId: z.string(), expiresAt: z.number() });
export type StatePayload = Omit<z.infer<typeof payloadSchema>, "expiresAt">;

const mac = (body: string) => createHmac("sha256", getEnv().BETTER_AUTH_SECRET).update(body).digest("base64url");

export function signState(payload: StatePayload): string {
  const body = Buffer.from(JSON.stringify({ ...payload, expiresAt: Date.now() + TTL_MS })).toString("base64url");
  return `${body}.${mac(body)}`;
}

export function verifyState(token: string | null): StatePayload | null {
  const [body, signature] = token?.split(".") ?? [];
  if (!body || !signature) return null;
  const expected = Buffer.from(mac(body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  const parsed = payloadSchema.safeParse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
  return parsed.success && parsed.data.expiresAt > Date.now() ? parsed.data : null;
}
