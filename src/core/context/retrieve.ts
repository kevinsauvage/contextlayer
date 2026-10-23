import type { Evidence, EvidenceKind } from "@/core/evidence/schemas";
import type { ContextSource } from "./source";

export type EvidenceCandidate = Omit<Evidence, "id">;

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "add",
  "new",
  "improve",
  "fix",
  "make",
  "from",
  "into",
  "page",
  "when",
  "that",
  "this",
  "should",
  "would",
  "could",
  "have",
  "has",
  "are",
  "was",
  "not",
  "can",
  "will",
  "all",
]);
const MAX_TERMS = 8;
const READ_LIMIT = 20;
const WINDOW_LINES = 60;
const WINDOW_LEAD = 5;
const PATH_WEIGHT = 3;

export function extractTerms(text: string, max = MAX_TERMS): string[] {
  const frequency = new Map<string, number>();
  for (const term of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (term.length > 2 && !STOPWORDS.has(term)) frequency.set(term, (frequency.get(term) ?? 0) + 1);
  }
  return [...frequency]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([term]) => term);
}

function classifyKind(path: string): EvidenceKind {
  const lower = path.toLowerCase();
  if (/(^|\/)(adr|decisions?)\//.test(lower)) return "decision";
  if (lower.endsWith(".md") || lower.endsWith(".mdx")) return "documentation";
  return "code";
}

const countMatches = (text: string, terms: string[]) => terms.filter((t) => text.includes(t)).length;

function excerptAround(content: string, terms: string[]) {
  const lines = content.split("\n");
  const firstHit = lines.findIndex((line) => terms.some((t) => line.toLowerCase().includes(t)));
  const start = Math.max(0, firstHit - WINDOW_LEAD);
  const window = lines.slice(start, start + WINDOW_LINES);
  return { text: window.join("\n").trim(), lines: { start: start + 1, end: start + Math.max(window.length, 1) } };
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

  return scored
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, maxCandidates)
    .map(({ path, content }) => {
      const excerpt = excerptAround(content, terms);
      return {
        kind: classifyKind(path),
        reference: path,
        url: source.urlFor?.(path, excerpt.lines),
        lines: excerpt.lines,
        excerpt: excerpt.text || path,
      };
    });
}
