import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  fake: false,
  generatorArgs: [] as unknown[],
  selectorArgs: [] as unknown[],
}));

vi.mock("@/infrastructure/env", () => ({
  getEnv: () => ({ E2E_FAKE_PROVIDERS: state.fake, AI_MODEL: "test/model" }),
}));

vi.mock("@/integrations/ai/generator", () => ({
  AiGenerator: function AiGenerator(this: unknown, ...args: unknown[]) {
    state.generatorArgs.push(args);
  },
}));

vi.mock("@/integrations/ai/evidence-agent", () => ({
  AiEvidenceAgent: function AiEvidenceAgent(this: unknown, ...args: unknown[]) {
    state.selectorArgs.push(args);
  },
}));

vi.mock("@/integrations/fake/generator", () => ({
  cannedGenerator: { kind: "canned" },
  firstFilesSelector: { kind: "first-files" },
}));

const { defaultGenerator, defaultSelector } = await import("@/features/analysis/context");

beforeEach(() => {
  state.fake = false;
  state.generatorArgs.length = 0;
  state.selectorArgs.length = 0;
});

describe("defaultGenerator", () => {
  it("uses the canned generator on the fake-provider server", () => {
    state.fake = true;
    expect(defaultGenerator()).toEqual({ kind: "canned" });
    expect(state.generatorArgs).toEqual([]);
  });

  it("builds the model generator with the configured model, deadline and usage meter", () => {
    const deadline = new AbortController().signal;
    const onUsage = vi.fn();

    defaultGenerator(deadline, onUsage);

    expect(state.generatorArgs).toEqual([["test/model", deadline, onUsage]]);
  });
});

describe("defaultSelector", () => {
  it("uses the first-files selector on the fake-provider server", () => {
    state.fake = true;
    expect(defaultSelector()).toEqual({ kind: "first-files" });
    expect(state.selectorArgs).toEqual([]);
  });

  it("builds the evidence agent with the same deadline and usage meter", () => {
    const deadline = new AbortController().signal;
    const onUsage = vi.fn();

    defaultSelector(deadline, onUsage);

    expect(state.selectorArgs).toEqual([["test/model", deadline, onUsage]]);
  });
});
