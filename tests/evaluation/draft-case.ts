import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { draftTicket } from "@/core/analysis/analyze";
import { AiGenerator } from "@/integrations/ai/generator";
import { DirectorySource } from "@/integrations/filesystem/directory-source";
import { getEnv } from "@/infrastructure/env";
import { noIssues } from "../helpers/fakes";
import type { LoadedCase } from "./fixtures";

export const RESULTS_DIR = path.join(import.meta.dirname, "results");

// Drafts a fixture with the current pipeline and writes results/<case>.json, which the blind review export reads.
export async function draftCase(c: LoadedCase) {
  const startedAt = Date.now();
  const result = await draftTicket({
    request: c.title,
    source: new DirectorySource(c.repoDir),
    tracker: noIssues,
    generator: new AiGenerator(getEnv().AI_MODEL),
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
  return { ...result, latencyMs, retrievalRecall };
}
