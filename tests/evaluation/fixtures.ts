import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { IssueTracker } from "@/core/context/source";
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

// A case may have a full request; the title is its short label (and the whole request when shorter).
export const requestOf = (c: EvaluationCase) => c.request ?? c.title;

// The tracker a fixture expects: related issues for retrieval, and the audited issue for audit cases.
export function trackerOf(c: EvaluationCase): IssueTracker {
  const related = c.relatedIssues;
  const audited = c.issue;
  return {
    searchRelated: async () => related,
    getIssue: async (key) => {
      const issue = audited?.key === key ? audited : related.find((candidate) => candidate.key === key);
      if (!issue) throw new Error(`fixture has no issue ${key}`);
      return issue;
    },
    createIssue: async () => ({
      key: `${c.id.toUpperCase()}-1`,
      url: `https://jira.test/browse/${c.id.toUpperCase()}-1`,
    }),
    updateIssue: async (key) => ({ key, url: `https://jira.test/browse/${key}` }),
  };
}

export type RepositoryFile = { path: string; content: string };

// Fixture repositories are a few files each, so the judge can read all of them.
export function readRepository(c: LoadedCase, dir = c.repoDir): RepositoryFile[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory()
      ? readRepository(c, full)
      : [{ path: path.relative(c.repoDir, full), content: readFileSync(full, "utf8") }];
  });
}
