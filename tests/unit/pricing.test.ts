import { describe, expect, it } from "vitest";
import { estimateCostUsd, modelPrice } from "@/core/analysis/pricing";

describe("model pricing", () => {
  it("prices a known model from its input and output rates", () => {
    expect(modelPrice("deepseek-flash")).toEqual({ input: 0.15, output: 0.6 });
    expect(estimateCostUsd("deepseek-flash", { inputTokens: 2_000_000, outputTokens: 1_000_000 })).toBeCloseTo(0.9);
  });

  it("returns no cost rather than a guess for an unknown model or a missing usage", () => {
    expect(modelPrice("some/unknown-model")).toBeNull();
    expect(estimateCostUsd("some/unknown-model", { inputTokens: 10, outputTokens: 10 })).toBeNull();
    expect(estimateCostUsd("deepseek-flash", undefined)).toBeNull();
    expect(estimateCostUsd(null, { inputTokens: 10, outputTokens: 10 })).toBeNull();
  });
});
