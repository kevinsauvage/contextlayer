import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getEnv } from "@/infrastructure/env";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

const key = () => Buffer.from(getEnv().ENCRYPTION_KEY, "base64");

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString("base64")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, body] = payload.split(".").map((part) => Buffer.from(part, "base64"));
  const decipher = createDecipheriv(ALGORITHM, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}
