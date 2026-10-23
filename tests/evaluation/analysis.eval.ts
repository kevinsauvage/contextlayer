import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeTitle } from "@/core/analysis/analyze";
import { AiGenerator } from "@/integrations/ai/generator";
import { DirectorySource } from "@/integrations/filesystem/directory-source";
import { getEnv } from "@/infrastructure/env";
import { noIssues } from "../helpers/fakes";
import { loadEvaluationCases } from "./fixtures";

const RESULTS_DIR = path.join(import.meta.dirname, "results");
const generator = new AiGenerator(getEnv().AI_MODEL);

describe.skipIf(!process.env.AI_GATEWAY_API_KEY && !process.env.AI_BASE_URL)("analysis evaluation", () => {
  it.each(loadEvaluationCases().map((c) => [c.id, c] as const))("%s", async (_id, c) => {
    const startedAt = Date.now();
    const result = await analyzeTitle({
      title: c.title,
      source: new DirectorySource(c.repoDir),
      tracker: noIssues,
      generator,
    });
    const latencyMs = Date.now() - startedAt;

    const retrieved = new Set(result.candidates.map((e) => `repo/${e.reference}`));
    const retrievalRecall =
      c.expected.relevantFiles.filter((f) => retrieved.has(f)).length / c.expected.relevantFiles.length;

    mkdirSync(RESULTS_DIR, { recursive: true });
    writeFileSync(
      path.join(RESULTS_DIR, `${c.id}.json`),
      JSON.stringify(
        {
          model: getEnv().AI_MODEL,
          latencyMs,
          retrievalRecall,
          usage: result.usage,
          issues: result.issues,
          expected: c.expected,
          draft: result.draft,
        },
        null,
        2,
      ),
    );

    expect(result.issues).toEqual([]);
  });
});
