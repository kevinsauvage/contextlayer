import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Issue, IssueTracker } from "@/core/context/source";
import { evaluationCaseSchema, type EvaluationCase } from "@/core/evaluation/fixtures";
import { GitSource } from "@/integrations/git/git-source";

const FIXTURES_DIR = path.join(import.meta.dirname, "..", "fixtures");

export type LoadedCase = EvaluationCase & { dir: string; repoDir: string };

export function loadEvaluationCases(): LoadedCase[] {
  return readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = path.join(FIXTURES_DIR, entry.name);
      const parsed = evaluationCaseSchema.parse(JSON.parse(readFileSync(path.join(dir, "case.json"), "utf8")));
      const repoDir = parsed.repository ? path.resolve(dir, parsed.repository.root) : path.join(dir, "repo");
      return { ...parsed, dir, repoDir };
    });
}

// A fixture with a `repository` reads its checkout at the pinned commit, so a measurement is reproducible.
export const sourceOf = (c: LoadedCase) => GitSource.open(c.repoDir, c.repository?.commit);

// `relevantFiles` are written relative to the case directory; only the part below `repo/` names a file.
// A pinned case is checked at its commit, not in the working tree, which has moved on since.
export const fileExists = (c: LoadedCase, relative: string) => {
  const file = relative.replace(/^repo\//, "");
  if (c.repository) {
    try {
      execFileSync("git", ["cat-file", "-e", `${c.repository.commit}:${file}`], { cwd: c.repoDir, stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }
  return existsSync(path.join(c.repoDir, file));
};

// A case may have a full request; the title is its short label (and the whole request when shorter).
export const requestOf = (c: EvaluationCase) => c.request ?? c.title;

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

// The real tracker searches by the query's terms, so a fixture must too: returning every issue would hide a
// retrieval that found nothing, and would reward a run that searched badly.
const relatedByQuery = (issues: Issue[], terms: string[], limit: number): Issue[] =>
  issues
    .map((issue) => {
      const text = normalize(`${issue.summary} ${issue.description}`);
      return { issue, hits: terms.filter((term) => text.includes(normalize(term))).length };
    })
    .filter(({ hits }) => hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit)
    .map(({ issue }) => issue);

// The tracker a fixture expects: related issues for retrieval, and the audited issue for audit cases.
export function trackerOf(c: EvaluationCase): IssueTracker {
  const related = c.relatedIssues;
  const audited = c.issue;
  return {
    searchRelated: async (terms, limit) => relatedByQuery(related, terms, limit),
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

// Fenced content is data. Escaping its closing tag, in any spacing or case, keeps a file or a draft from ending the
// block early.
export const escapeTag = (text: string, tag: string) =>
  text.replace(new RegExp(`<\\s*/\\s*${tag}\\s*>`, "gi"), `<\\/${tag}>`);

export const repositoryPrompt = (files: RepositoryFile[]) =>
  `<repository>\n${files
    .map(
      (file) =>
        `<file path="${escapeTag(file.path, "file")}">\n${escapeTag(escapeTag(file.content, "file"), "repository")}\n</file>`,
    )
    .join("\n")}\n</repository>`;
