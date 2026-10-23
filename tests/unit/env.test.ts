import { describe, expect, it } from "vitest";
import { parseEnv } from "@/infrastructure/env";

const required = {
  DATABASE_URL: "postgres://test:test@localhost:5432/test",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123",
  BETTER_AUTH_URL: "http://localhost:3000",
  ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
};

describe("parseEnv", () => {
  it("treats blank values as unset", () => {
    const env = parseEnv({ ...required, AI_BASE_URL: "", AI_API_KEY: "", GITHUB_APP_ID: "" });
    expect(env.AI_BASE_URL).toBeUndefined();
    expect(env.GITHUB_APP_ID).toBeUndefined();
  });

  it("defaults the model and keeps structured outputs on", () => {
    const env = parseEnv(required);
    expect(env.AI_MODEL).toBe("anthropic/claude-sonnet-5.5");
    expect(env.AI_STRUCTURED_OUTPUTS).toBe(true);
  });

  it("reads AI_STRUCTURED_OUTPUTS=false", () =>
    expect(parseEnv({ ...required, AI_STRUCTURED_OUTPUTS: "false" }).AI_STRUCTURED_OUTPUTS).toBe(false));

  it("rejects a blank required secret", () =>
    expect(() => parseEnv({ ...required, BETTER_AUTH_SECRET: "" })).toThrow());

  it("rejects an invalid AI_BASE_URL", () =>
    expect(() => parseEnv({ ...required, AI_BASE_URL: "not-a-url" })).toThrow());
});
