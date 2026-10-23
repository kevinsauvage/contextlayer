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
  "change",
  "update",
  "replace",
  "rename",
  "remove",
  "set",
  "show",
  "display",
]);
const MAX_TERMS = 10;
const READ_LIMIT = 20;
const WINDOW_LINES = 60;
const WINDOW_LEAD = 5;
const PATH_WEIGHT = 3;

// Requests name UI parts loosely ("banner" for a hero section); code names them one way. Kept small and generic
// until LLM query expansion exists.
const SYNONYMS: Record<string, string[]> = {
  banner: ["hero", "header"],
  hero: ["banner"],
  title: ["heading", "headline"],
  heading: ["title"],
  headline: ["title", "heading"],
  popup: ["modal", "dialog"],
  modal: ["dialog", "popup"],
  dialog: ["modal"],
  login: ["signin", "auth"],
  signin: ["login", "auth"],
  signup: ["register"],
  navbar: ["nav", "navigation", "header"],
  menu: ["nav", "navigation"],
  footer: ["layout"],
};

// A quoted string in a request is usually the new value, which the code cannot contain yet.
const QUOTED_LITERAL = /"[^"]*"|“[^”]*”|`[^`]*`/g;

const normalize = (text: string) =>
  text
    .replace(QUOTED_LITERAL, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function extractTerms(text: string, max = MAX_TERMS): string[] {
  const frequency = new Map<string, number>();
  for (const term of normalize(text).split(/[^a-z0-9]+/)) {
    if (term.length > 2 && !STOPWORDS.has(term)) frequency.set(term, (frequency.get(term) ?? 0) + 1);
  }
  const primary = [...frequency]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([term]) => term);
  return [...new Set([...primary, ...primary.flatMap((term) => SYNONYMS[term] ?? [])])];
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

const IMPORT_SPECIFIER = /\bfrom\s+["']([^"']+)["']/g;
const RESOLVE_SUFFIXES = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", "/index.ts", "/index.tsx", "/index.js"];
const IMPORT_SOURCES = 3;
const MAX_IMPORTED = 3;
const IMPORTED_NAMES = /\bimport\s+(?:type\s+)?\{([^}]*)\}/g;
const isBarrel = (path: string) => /(^|\/)index\.[jt]sx?$/.test(path);

function joinPath(dir: string, relativePath: string): string {
  const parts: string[] = [];
  for (const part of `${dir}/${relativePath}`.split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}

// Resolves relative and "@/" or "~/" alias imports against the repository's file list; packages are skipped.
function resolveImports(from: string, content: string, paths: Set<string>): string[] {
  const dir = from.split("/").slice(0, -1).join("/");
  return [...content.matchAll(IMPORT_SPECIFIER)].flatMap(([, specifier = ""]) => {
    const alias = /^[@~]\//.exec(specifier);
    const bases = specifier.startsWith(".")
      ? [joinPath(dir, specifier)]
      : alias
        ? [`src/${specifier.slice(2)}`, specifier.slice(2)]
        : [];
    const resolved = bases.flatMap((base) => RESOLVE_SUFFIXES.map((suffix) => base + suffix)).find((p) => paths.has(p));
    return resolved ? [resolved] : [];
  });
}

type ScoredFile = { path: string; content: string; score: number };

// Imported identifier → rank of the best-ranked file importing it.
function importedNames(files: ScoredFile[]): Map<string, number> {
  const ranks = new Map<string, number>();
  files.forEach((file, rank) => {
    for (const [, names = ""] of file.content.matchAll(IMPORTED_NAMES)) {
      for (const name of names.split(",")) {
        const key = (name.trim().split(/\s+as\s+/)[0] ?? "").toLowerCase();
        if (key && !ranks.has(key)) ranks.set(key, rank);
      }
    }
  });
  return ranks;
}

const baseName = (path: string) => (path.split("/").at(-1) ?? "").replace(/\.[^.]+$/, "").toLowerCase();

// Copy and settings usually live in a module the matching component imports (a content or config file whose name
// shares nothing with the title), so the top files' imports are followed one hop, and through barrel files.
async function importedEvidence(top: ScoredFile[], paths: string[], source: ContextSource, terms: string[]) {
  const known = new Set(paths);
  const seen = new Set(top.map((file) => file.path));
  const found: (ScoredFile & { importerRank: number })[] = [];
  let frontier = top.slice(0, IMPORT_SOURCES);
  // `import { sections } from "@/config/content"` points at content/sections.ts through the barrel.
  const names = importedNames(frontier);
  for (let hop = 0; hop < 2 && frontier.length; hop += 1) {
    const next = [...new Set(frontier.flatMap((file) => resolveImports(file.path, file.content, known)))].filter(
      (path) => !seen.has(path) && (hop === 0 || !isBarrel(path)),
    );
    next.forEach((path) => seen.add(path));
    const read = await Promise.all(
      next.map(async (path) => {
        const content = await source.readFile(path);
        const importerRank = names.get(baseName(path)) ?? IMPORT_SOURCES;
        const named = importerRank < IMPORT_SOURCES ? PATH_WEIGHT : 0;
        return { path, content, importerRank, score: countMatches(content.toLowerCase(), terms) + named };
      }),
    );
    found.push(...read.filter((file) => file.score > 0 && !isBarrel(file.path)));
    frontier = read.filter((file) => isBarrel(file.path));
  }
  return found.sort((a, b) => b.score - a.score || a.importerRank - b.importerRank).slice(0, MAX_IMPORTED);
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
  const imported = await importedEvidence(ranked, paths, source, terms);

  return [...ranked.slice(0, maxCandidates - imported.length), ...imported].map((file) =>
    toCandidate(file, terms, source),
  );
}
