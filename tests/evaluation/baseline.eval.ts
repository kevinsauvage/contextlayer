import { writeFileSync } from "node:fs";
import path from "node:path";
import { generateText, Output } from "ai";
import { describe, it } from "vitest";
import { z } from "zod";
import { withSchemaInstruction } from "@/integrations/ai/generator";
import { resolveJudgeModel, resolveModel } from "@/integrations/ai/model";
import { getEnv } from "@/infrastructure/env";
import { draftCase, RESULTS_DIR } from "./draft-case";
import { loadEvaluationCases, readRepository, type LoadedCase, type RepositoryFile } from "./fixtures";

const modelId = getEnv().AI_MODEL;
const model = resolveModel(modelId);
const judge = resolveJudgeModel();

if (judge.isGenerator) {
  console.warn(`AI_JUDGE_MODEL is unset or equals AI_MODEL (${modelId}): the judge grades its own drafts.`);
}

const BASELINE_SYSTEM_PROMPT =
  "You are a product engineer. Turn the ticket title into a complete Jira ticket with a description and acceptance criteria.";

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

const repositoryBlock = (files: RepositoryFile[]) =>
  files.map((file) => `<file path="${file.path}">\n${file.content}\n</file>`).join("\n");

// The repository is the source of truth: a claim it supports is correct even if `expected` does not list it.
function buildJudgePrompt(c: LoadedCase, baseline: string, contextlayer: unknown) {
  return [
    "Score three versions of a ticket written for the repository below, 0-2 per criterion (0 fails, 1 partial, 2 good).",
    "Source of truth: the repository files. A claim is correct when the files support it. It is wrong when the files contradict it, or when it states as fact something the files cannot show (business intent, users' complaints, numbers, deadlines, compliance targets). Check every factual claim against the files yourself, whether or not it cites a source.",
    `<repository>\n${repositoryBlock(readRepository(c))}\n</repository>`,
    "Reviewer notes for this case (guidance, not an exhaustive list of true facts): verifiedFacts are facts a good ticket should establish; mustStayUncertain are points the files cannot settle, so a good ticket leaves them open; forbiddenClaims must not be presented as requirements.",
    JSON.stringify(c.expected, null, 2),
    "Criteria: factualCorrectness (every factual claim is supported by the files; one contradicted or invented fact caps it at 1, several at 0), evidenceTraceability (a reader can inspect the source of each claim; text without citations scores 0), requirementFidelity (no invented business intent; a forbiddenClaim presented as a requirement scores 0), actionability (a developer knows what to change and where), acceptanceCriteria (clear, testable, product decisions marked), uncertaintyHandling (mustStayUncertain items exposed rather than decided).",
    "Score each version on its own merits. Do not reward length or formatting. In each rationale, name any claim you counted as wrong and why.",
    `## original\n${c.title}`,
    `## baseline\n${baseline}`,
    `## contextlayer\n${JSON.stringify(contextlayer, null, 2)}`,
  ].join("\n\n");
}

const hasModel = Boolean(process.env.AI_GATEWAY_API_KEY) || Boolean(process.env.AI_BASE_URL);

describe.skipIf(!hasModel)("baseline comparison", () => {
  it.each(loadEvaluationCases().map((c) => [c.id, c] as const))("%s", async (_id, c) => {
    const contextlayer = await draftCase(c);

    const startedAt = Date.now();
    const { text, usage } = await generateText({ model, instructions: BASELINE_SYSTEM_PROMPT, prompt: c.title });
    const baselineLatencyMs = Date.now() - startedAt;

    const { output: judgment } = await generateText({
      model: judge.model,
      prompt: withSchemaInstruction(
        buildJudgePrompt(c, text, contextlayer.draft),
        judgmentSchema,
        judge.structuredOutputs,
      ),
      output: Output.object({ schema: judgmentSchema }),
    });

    writeFileSync(
      path.join(RESULTS_DIR, `${c.id}.baseline.json`),
      JSON.stringify(
        {
          model: modelId,
          judgeModel: judge.modelId,
          judgeIsGenerator: judge.isGenerator,
          baseline: {
            latencyMs: baselineLatencyMs,
            usage: { inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0 },
            text,
          },
          contextlayer: {
            latencyMs: contextlayer.latencyMs,
            usage: contextlayer.usage,
            retrievalRecall: contextlayer.retrievalRecall,
          },
          judgment,
        },
        null,
        2,
      ),
    );
  });
});
