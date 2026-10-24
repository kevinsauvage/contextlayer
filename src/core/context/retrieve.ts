import type { Evidence, EvidenceKind } from "@/core/evidence/schemas";
import { followImports, type ScoredFile } from "./imports";
import type { ContextSource } from "./source";
import { PATH_WEIGHT, countMatches, scoreMatches } from "./terms";

export type EvidenceCandidate = Omit<Evidence, "id">;

const READ_LIMIT = 20;
const WINDOW_LINES = 60;
const WINDOW_LEAD = 5;
const TEST_PENALTY = 2;

// Tests describe behavior but are not where copy, styles or logic live, so they are evidence of last resort.
const isTestPath = (path: string) => /(^|\/)(e2e|tests?)\/|\.(test|spec)\.[jt]sx?$/.test(path);
const withTestPenalty = (path: string, score: number) => (isTestPath(path) ? score - TEST_PENALTY : score);

function classifyKind(path: string): EvidenceKind {
  const lower = path.toLowerCase();
  if (/(^|\/)(adr|decisions?)\//.test(lower)) return "decision";
  if (lower.endsWith(".md") || lower.endsWith(".mdx")) return "documentation";
  return "code";
}

function excerptAround(content: string, terms: string[]) {
  const lines = content.split("\n");
  const firstHit = lines.findIndex((line) => terms.some((t) => line.toLowerCase().includes(t)));
  const start = Math.max(0, firstHit - WINDOW_LEAD);
  const window = lines.slice(start, start + WINDOW_LINES);
  return { text: window.join("\n").trim(), lines: { start: start + 1, end: start + Math.max(window.length, 1) } };
}

function toCandidate(file: ScoredFile, terms: string[], source: ContextSource): EvidenceCandidate {
  const excerpt = excerptAround(file.content, terms);
  return {
    kind: classifyKind(file.path),
    reference: file.path,
    url: source.urlFor?.(file.path, excerpt.lines),
    lines: excerpt.lines,
    excerpt: excerpt.text || file.path,
  };
}

export async function retrieveFileEvidence(
  terms: string[],
  source: ContextSource,
  maxCandidates = 10,
): Promise<EvidenceCandidate[]> {
  if (!terms.length) return [];
  const [paths, searchHits] = await Promise.all([source.listFiles(), source.searchContent?.(terms) ?? []]);
  // A hit ranks by where the provider put it, not merely by being a hit: the first result is the strongest
  // signal that a term lives in that file.
  const searchRank = new Map(searchHits.map((path, index) => [path, searchHits.length - index]));

  const shortlist = paths
    .map((path) => ({
      path,
      // Search rank only decides what to read; relevance is scored from the file name and content below.
      priority: withTestPenalty(
        path,
        countMatches(path.toLowerCase(), terms) * PATH_WEIGHT + (searchRank.get(path) ?? 0),
      ),
    }))
    .filter((file) => file.priority > 0)
    .sort((a, b) => b.priority - a.priority || a.path.localeCompare(b.path))
    .slice(0, READ_LIMIT);

  const scored = await Promise.all(
    shortlist.map(async ({ path }) => {
      const content = await source.readFile(path);
      return {
        path,
        content,
        score: withTestPenalty(
          path,
          countMatches(path.toLowerCase(), terms) * PATH_WEIGHT + scoreMatches(content.toLowerCase(), terms),
        ),
      };
    }),
  );
  const ranked = scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const imported = await followImports(ranked, paths, source, terms);

  return [...ranked.slice(0, maxCandidates - imported.length), ...imported].map((file) =>
    toCandidate(file, terms, source),
  );
}
