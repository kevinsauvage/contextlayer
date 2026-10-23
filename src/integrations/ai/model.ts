import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { getEnv } from "@/infrastructure/env";

export function resolveModel(modelId: string): LanguageModel {
  const { AI_BASE_URL, AI_API_KEY, AI_STRUCTURED_OUTPUTS } = getEnv();
  if (!AI_BASE_URL) return modelId;

  return createOpenAICompatible({
    name: "openai-compatible",
    baseURL: AI_BASE_URL,
    apiKey: AI_API_KEY,
    supportsStructuredOutputs: AI_STRUCTURED_OUTPUTS,
  })(modelId);
}
