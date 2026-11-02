import { describe, expect, it } from "vitest";
import { estimateCostUsd } from "@/features/analysis/cost";
import { parseEnv } from "@/infrastructure/env";

const usage = { inputTokens: 1_000_000, outputTokens: 100_000 };
const env = {
  DATABASE_URL: "postgres://x",
  BETTER_AUTH_SECRET: "s".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
};

describe("estimateCostUsd", () => {
  it("prices the default model, so a fresh install shows a cost", () => {
    expect(estimateCostUsd(parseEnv(env).AI_MODEL, usage)).not.toBeNull();
  });

  it("prices input and output separately, whatever the model id's case", () => {
    expect(estimateCostUsd("DeepSeek-Flash", usage)).toBe(0.21);
  });

  it("shows no cost for an unknown model or a run without usage", () => {
    expect(estimateCostUsd("unknown/model", usage)).toBeNull();
    expect(estimateCostUsd(null, usage)).toBeNull();
    expect(estimateCostUsd("deepseek-flash", undefined)).toBeNull();
  });
});
