import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "vitest";
import { gatherContext } from "@/core/context/gather";
import { AiGenerator } from "@/integrations/ai/generator";
import { getEnv } from "@/infrastructure/env";
import { RESULTS_DIR } from "./draft-case";
import { loadEvaluationCases, requestOf, sourceOf, trackerOf } from "./fixtures";

const hasModel = Boolean(process.env.AI_GATEWAY_API_KEY) || Boolean(process.env.AI_BASE_URL);

// Every case declares the files a good ticket must touch, so recall is measurable without judging a draft:
// the share of those files retrieval actually handed to the model, with the query expansion production runs.
// The numbers land in results/retrieval-recall.json and are recorded in validation-experiments.md (E6).
describe.skipIf(!hasModel)("retrieval recall", () => {
  const cases = loadEvaluationCases();

  it.each(cases.map((c) => [c.id, c] as const))("%s", async (_id, c) => {
    const query = c.kind === "audit" && c.issue ? `${c.issue.summary} ${c.issue.description}` : requestOf(c);
    const generator = new AiGenerator(getEnv().AI_MODEL);
    const { evidence, usage } = await gatherContext({
      query,
      source: await sourceOf(c),
      tracker: trackerOf(c),
      excludeIssueKey: c.issue?.key,
      expander: generator,
    });
    const retrieved = new Set(evidence.map((item) => `repo/${item.reference}`));
    const missed = c.expected.relevantFiles.filter((file) => !retrieved.has(file));
    // A file the keyword path finds and expansion loses is a regression of the expansion, not a known miss.
    const unexpected = missed.filter((file) => !c.expected.knownMisses.includes(file));

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
          unexpected,
          recall,
          usage,
        },
        null,
        2,
      ),
    );
  });
});
