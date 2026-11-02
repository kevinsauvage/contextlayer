import type { LanguageModelUsage } from "ai";
import type { TokenUsage } from "@/core/analysis/generators";

// A provider may omit a count; the run records zero rather than dropping the call.
export const tokenUsage = (usage: Pick<LanguageModelUsage, "inputTokens" | "outputTokens">): TokenUsage => ({
  inputTokens: usage.inputTokens ?? 0,
  outputTokens: usage.outputTokens ?? 0,
});
