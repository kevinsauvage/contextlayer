import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { AiGenerator } from "@/integrations/ai/generator";

const state = vi.hoisted(() => ({ model: undefined as MockLanguageModelV4 | undefined }));
vi.mock("@/integrations/ai/model", () => ({ resolveModel: () => state.model }));

const answer = (text: string, input: number, output: number) => ({
  content: [{ type: "text" as const, text }],
  finishReason: { unified: "stop" as const, raw: undefined },
  usage: {
    inputTokens: { total: input, noCache: input, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: output, text: output, reasoning: undefined },
  },
  warnings: [],
});

const draft = {
  title: "Round cart totals",
  description: [{ text: "Totals are rounded down.", status: "inferred", evidenceIds: [] }],
  acceptanceCriteria: [],
  assumptions: [],
  openQuestions: [],
};

describe("AiGenerator", () => {
  it("counts the tokens of an answer it discarded and retried", async () => {
    const replies = [answer("not json", 100, 10), answer(JSON.stringify(draft), 120, 40)];
    state.model = new MockLanguageModelV4({
      doGenerate: async () => {
        const reply = replies.shift();
        if (!reply) throw new Error("called too often");
        return reply;
      },
    });

    const result = await new AiGenerator("mock").generate({ request: "Round totals", answers: [], candidates: [] });

    expect(result.body.title).toBe("Round cart totals");
    expect(result.usage).toEqual({ inputTokens: 220, outputTokens: 50 });
  });
});
