import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { getEnv } from "@/infrastructure/env";

type ModelConfig = { modelId: string; baseUrl?: string; apiKey?: string; structuredOutputs: boolean };

const createModel = ({ modelId, baseUrl, apiKey, structuredOutputs }: ModelConfig): LanguageModel => {
  if (!baseUrl) return modelId;

  return createOpenAICompatible({
    name: "openai-compatible",
    baseURL: baseUrl,
    apiKey,
    supportsStructuredOutputs: structuredOutputs,
  })(modelId);
};

export function resolveModel(modelId: string): LanguageModel {
  const { AI_BASE_URL, AI_API_KEY, AI_STRUCTURED_OUTPUTS } = getEnv();
  return createModel({ modelId, baseUrl: AI_BASE_URL, apiKey: AI_API_KEY, structuredOutputs: AI_STRUCTURED_OUTPUTS });
}

export type JudgeModel = {
  model: LanguageModel;
  modelId: string;
  structuredOutputs: boolean;
  /** A judge that shares the generator's model and endpoint grades its own output. */
  isGenerator: boolean;
};

export function resolveJudgeModel(): JudgeModel {
  const env = getEnv();
  const modelId = env.AI_JUDGE_MODEL ?? env.AI_MODEL;
  const baseUrl = env.AI_JUDGE_BASE_URL ?? env.AI_BASE_URL;
  const structuredOutputs = env.AI_JUDGE_STRUCTURED_OUTPUTS ?? env.AI_STRUCTURED_OUTPUTS;

  return {
    model: createModel({
      modelId,
      baseUrl,
      apiKey: env.AI_JUDGE_API_KEY ?? env.AI_API_KEY,
      structuredOutputs,
    }),
    modelId,
    structuredOutputs,
    isGenerator: modelId === env.AI_MODEL && baseUrl === env.AI_BASE_URL,
  };
}
