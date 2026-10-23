import type { ContextSource } from "./source";
import { PATH_WEIGHT, countMatches } from "./terms";

export type ScoredFile = { path: string; content: string; score: number };

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

type ImportedFile = ScoredFile & { importerRank: number };

// Copy and settings usually live in a module the matching component imports (a content or config file whose name
// shares nothing with the title), so the top files' imports are followed one hop, and through barrel files.
export async function followImports(
  top: ScoredFile[],
  paths: string[],
  source: ContextSource,
  terms: string[],
): Promise<ImportedFile[]> {
  const known = new Set(paths);
  const seen = new Set(top.map((file) => file.path));
  const found: ImportedFile[] = [];
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
