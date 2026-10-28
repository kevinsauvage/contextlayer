import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "vitest";
import { gatherContext } from "@/core/context/gather";
import { AiEvidenceAgent } from "@/integrations/ai/evidence-agent";
import { getEnv } from "@/infrastructure/env";
import { RESULTS_DIR } from "./draft-case";
import { loadEvaluationCases, requestOf, sourceOf, trackerOf } from "./fixtures";

const hasModel = Boolean(process.env.AI_GATEWAY_API_KEY) || Boolean(process.env.AI_BASE_URL);

// Every case declares the files a good ticket must touch, so recall is measurable without judging a draft: the
// share of those files the evidence agent actually named. Results land in results/<case>.recall.json and are
// recorded in validation-experiments.md (E6).
describe.skipIf(!hasModel)("retrieval recall", () => {
  const cases = loadEvaluationCases();

  it.each(cases.map((c) => [c.id, c] as const))("%s", async (_id, c) => {
    const query = c.kind === "audit" && c.issue ? `${c.issue.summary} ${c.issue.description}` : requestOf(c);
    const { evidence, usage } = await gatherContext({
      query,
      source: await sourceOf(c),
      tracker: trackerOf(c),
      excludeIssueKey: c.issue?.key,
      selector: new AiEvidenceAgent(getEnv().AI_MODEL),
    });
    const retrieved = new Set(evidence.map((item) => `repo/${item.reference}`));
    const missed = c.expected.relevantFiles.filter((file) => !retrieved.has(file));
    mkdirSync(RESULTS_DIR, { recursive: true });
    const recall = 1 - missed.length / c.expected.relevantFiles.length;
    writeFileSync(
      path.join(RESULTS_DIR, `${c.id}.recall.json`),
      JSON.stringify(
        {
          model: getEnv().AI_MODEL,
          query,
          expected: c.expected.relevantFiles,
          retrieved: [...retrieved],
          missed,
          recall,
          usage,
        },
        null,
        2,
      ),
    );
  });
});
