import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateText, Output } from "ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { withSchemaInstruction } from "@/integrations/ai/generator";
import { resolveModel } from "@/integrations/ai/model";
import { getEnv } from "@/infrastructure/env";
import { loadEvaluationCases, type LoadedCase } from "./fixtures";

const RESULTS_DIR = path.join(import.meta.dirname, "results");
const modelId = getEnv().AI_MODEL;
const model = resolveModel(modelId);

const BASELINE_SYSTEM_PROMPT = "You are a product engineer. Turn the ticket title into a complete Jira ticket with a description and acceptance criteria.";

const score = z.number().int().min(0).max(2);
const scoresSchema = z.object({
  factualCorrectness: score,
  evidenceTraceability: score,
  requirementFidelity: score,
  actionability: score,
  acceptanceCriteria: score,
  uncertaintyHandling: score,
  rationale: z.string(),
});
const judgmentSchema = z.object({ original: scoresSchema, baseline: scoresSchema, contextlayer: scoresSchema });

function buildJudgePrompt(c: LoadedCase, baseline: string, contextlayer: unknown) {
  return [
    "Score three versions of a Jira ticket 0-2 per criterion (0 fails, 1 partial, 2 good) using the rubric below.",
    "Ground truth about the project (use it as the only source of facts):",
    JSON.stringify(c.expected, null, 2),
    "Criteria: factualCorrectness (claims supported by the ground truth), evidenceTraceability (a reader can inspect the source of each claim; text without citations scores 0), requirementFidelity (no invented business intent; forbiddenClaims presented as requirements score 0), actionability, acceptanceCriteria (clear, testable, product decisions marked), uncertaintyHandling (mustStayUncertain items exposed rather than decided).",
    `## original\n${c.title}`,
    `## baseline\n${baseline}`,
    `## contextlayer\n${JSON.stringify(contextlayer, null, 2)}`,
  ].join("\n\n");
}

const hasModel = Boolean(process.env.AI_GATEWAY_API_KEY || process.env.AI_BASE_URL);

describe.skipIf(!hasModel)("baseline comparison", () => {
  it.each(loadEvaluationCases().map((c) => [c.id, c] as const))("%s", async (_id, c) => {
    const resultPath = path.join(RESULTS_DIR, `${c.id}.json`);
    expect(existsSync(resultPath), "run analysis.eval.ts first").toBe(true);
    const contextlayer = JSON.parse(readFileSync(resultPath, "utf8"));

    const startedAt = Date.now();
    const { text, usage } = await generateText({ model, system: BASELINE_SYSTEM_PROMPT, prompt: c.title });
    const baselineLatencyMs = Date.now() - startedAt;

    const { output: judgment } = await generateText({
      model,
      prompt: withSchemaInstruction(buildJudgePrompt(c, text, contextlayer.draft), judgmentSchema),
      output: Output.object({ schema: judgmentSchema }),
    });

    writeFileSync(
      path.join(RESULTS_DIR, `${c.id}.baseline.json`),
      JSON.stringify(
        {
          model: modelId,
          baseline: { latencyMs: baselineLatencyMs, usage: { inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0 }, text },
          contextlayer: { latencyMs: contextlayer.latencyMs, usage: contextlayer.usage },
          judgment,
        },
        null,
        2,
      ),
    );
  }, 600_000);
});
