import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "@/infrastructure/crypto";
import { signState, verifyState } from "@/infrastructure/signed-state";

describe("encrypt/decrypt", () => {
  it("round-trips and never stores plaintext", () => {
    const sealed = encrypt("atlassian-refresh-token");
    expect(sealed).not.toContain("atlassian");
    expect(decrypt(sealed)).toBe("atlassian-refresh-token");
  });

  it("uses a fresh IV each time", () => expect(encrypt("a")).not.toBe(encrypt("a")));

  it("rejects tampered ciphertext", () => {
    const [iv, tag, body] = encrypt("secret").split(".");
    const flipped = Buffer.from(body ?? "", "base64");
    flipped.writeUInt8(flipped.readUInt8(0) ^ 1, 0);
    expect(() => decrypt([iv, tag, flipped.toString("base64")].join("."))).toThrow();
  });

  it("rejects malformed payloads", () => expect(() => decrypt("not-a-payload")).toThrow("Malformed"));
});

describe("signed state", () => {
  const payload = { userId: "u1", organizationId: "o1" };

  it("verifies its own tokens", () => expect(verifyState(signState(payload))).toMatchObject(payload));

  it("rejects tampered or foreign tokens", () => {
    const [body, signature] = signState(payload).split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...payload, organizationId: "o2", expiresAt: Date.now() + 1e6 }),
    ).toString("base64url");
    expect(verifyState(`${forged}.${signature}`)).toBeNull();
    expect(verifyState(`${body}.bad`)).toBeNull();
    expect(verifyState(null)).toBeNull();
  });
});
