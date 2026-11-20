import { beforeEach, describe, expect, it, vi } from "vitest";

type TestEnv = {
  AI_MODEL: string;
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  AI_STRUCTURED_OUTPUTS?: boolean;
  AI_JUDGE_MODEL?: string;
  AI_JUDGE_BASE_URL?: string;
  AI_JUDGE_API_KEY?: string;
  AI_JUDGE_STRUCTURED_OUTPUTS?: boolean;
};

const state = vi.hoisted(() => {
  const env: TestEnv = { AI_MODEL: "anthropic/claude-sonnet-5.5", AI_STRUCTURED_OUTPUTS: true };
  return { env };
});

vi.mock("@/infrastructure/env", () => ({ getEnv: () => state.env }));

const { resolveJudgeModel, resolveModel } = await import("@/integrations/ai/model");
const { tokenUsage } = await import("@/integrations/ai/usage");

beforeEach(() => {
  state.env.AI_BASE_URL = undefined;
  state.env.AI_API_KEY = undefined;
  state.env.AI_STRUCTURED_OUTPUTS = true;
  state.env.AI_JUDGE_MODEL = undefined;
  state.env.AI_JUDGE_BASE_URL = undefined;
  state.env.AI_JUDGE_API_KEY = undefined;
  state.env.AI_JUDGE_STRUCTURED_OUTPUTS = undefined;
});

describe("resolveModel", () => {
  it("leaves the gateway model id untouched when no endpoint is configured", () => {
    expect(resolveModel("anthropic/claude-sonnet-5.5")).toBe("anthropic/claude-sonnet-5.5");
  });

  it("builds an OpenAI-compatible model for a custom endpoint", () => {
    state.env.AI_BASE_URL = "https://api.example.test/v1";
    state.env.AI_API_KEY = "sk-test";

    const model = resolveModel("deepseek-chat");

    expect(typeof model).toBe("object");
    expect(model).not.toBe("deepseek-chat");
  });
});

describe("resolveJudgeModel", () => {
  it("falls back to the generator's model and endpoint", () => {
    const judge = resolveJudgeModel();

    expect(judge).toMatchObject({
      modelId: "anthropic/claude-sonnet-5.5",
      structuredOutputs: true,
      isGenerator: true,
    });
  });

  it("uses the judge's own model and reports that it differs from the generator", () => {
    state.env.AI_JUDGE_MODEL = "gemini-3.8-flash";
    state.env.AI_BASE_URL = "https://generativelanguage.example.test/v1";
    state.env.AI_JUDGE_BASE_URL = "https://generativelanguage.example.test/v1";
    state.env.AI_JUDGE_STRUCTURED_OUTPUTS = false;

    const judge = resolveJudgeModel();

    expect(judge).toMatchObject({
      modelId: "gemini-3.8-flash",
      structuredOutputs: false,
      isGenerator: false,
    });
  });

  it("counts the same model on a different endpoint as another generator", () => {
    state.env.AI_BASE_URL = "https://generator.example.test/v1";
    state.env.AI_JUDGE_BASE_URL = "https://judge.example.test/v1";

    expect(resolveJudgeModel().isGenerator).toBe(false);
  });
});

describe("tokenUsage", () => {
  it("records zero for a count the provider omitted", () => {
    expect(tokenUsage({ inputTokens: 12, outputTokens: undefined })).toEqual({ inputTokens: 12, outputTokens: 0 });
    expect(tokenUsage({ inputTokens: null as unknown as undefined, outputTokens: 3 })).toEqual({
      inputTokens: 0,
      outputTokens: 3,
    });
    expect(tokenUsage({ inputTokens: undefined, outputTokens: undefined })).toEqual({
      inputTokens: 0,
      outputTokens: 0,
    });
  });
});
