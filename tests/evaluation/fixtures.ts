import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { evaluationCaseSchema, type EvaluationCase } from "@/core/evaluation/fixtures";

const FIXTURES_DIR = path.join(import.meta.dirname, "..", "fixtures");

export type LoadedCase = EvaluationCase & { dir: string; repoDir: string };

export function loadEvaluationCases(): LoadedCase[] {
  return readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = path.join(FIXTURES_DIR, entry.name);
      const parsed = evaluationCaseSchema.parse(JSON.parse(readFileSync(path.join(dir, "case.json"), "utf8")));
      return { ...parsed, dir, repoDir: path.join(dir, "repo") };
    });
}

export const fileExists = (c: LoadedCase, relative: string) => existsSync(path.join(c.dir, relative));
