import type { Evidence, EvidenceKind } from "@/core/evidence/schemas";
import { followImports, type ScoredFile } from "./imports";
import type { ContextSource } from "./source";
import { PATH_WEIGHT, countMatches } from "./terms";

export type EvidenceCandidate = Omit<Evidence, "id">;

const READ_LIMIT = 20;
const WINDOW_LINES = 60;
const WINDOW_LEAD = 5;

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
  maxCandidates = 8,
): Promise<EvidenceCandidate[]> {
  if (!terms.length) return [];
  const [paths, searchHits] = await Promise.all([source.listFiles(), source.searchContent?.(terms) ?? []]);
  const hits = new Set(searchHits);

  const shortlist = paths
    .map((path) => ({ path, score: countMatches(path.toLowerCase(), terms) * PATH_WEIGHT + (hits.has(path) ? 1 : 0) }))
    .filter((file) => file.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, READ_LIMIT);

  const scored = await Promise.all(
    shortlist.map(async ({ path, score }) => {
      const content = await source.readFile(path);
      return { path, content, score: score + countMatches(content.toLowerCase(), terms) };
    }),
  );
  const ranked = scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const imported = await followImports(ranked, paths, source, terms);

  return [...ranked.slice(0, maxCandidates - imported.length), ...imported].map((file) =>
    toCandidate(file, terms, source),
  );
}
