import type { TokenUsage } from "./generators";

// USD per million tokens, provider list prices as of 2026-10-26; a gateway may add its own fee.
// A model without an entry records no cost rather than a guess.
const PRICES: Record<string, { input: number; output: number }> = {
  "deepseek-flash": { input: 0.15, output: 0.6 },
  "deepseek-v4.1-flash": { input: 0.15, output: 0.6 },
  "deepseek-v4-pro": { input: 0.66, output: 1.98 },
  "anthropic/claude-sonnet-5.5": { input: 2, output: 10 },
};

const TOKENS_PER_MILLION = 1_000_000;
const COST_DECIMALS = 6;

export function modelPrice(model: string): { input: number; output: number } | null {
  return PRICES[model.toLowerCase()] ?? null;
}

export function estimateCostUsd(model: string | null, usage: TokenUsage | undefined): number | null {
  if (!model || !usage) return null;
  const price = modelPrice(model);
  if (!price) return null;
  const cost = (usage.inputTokens * price.input + usage.outputTokens * price.output) / TOKENS_PER_MILLION;
  return Number(cost.toFixed(COST_DECIMALS));
}
