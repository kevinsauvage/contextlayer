import type { ContextSource } from "./source";
import { joinPath, parseAliasConfig, resolveAlias, type AliasConfig } from "./paths";
import { PATH_WEIGHT, scoreMatches } from "./terms";

export type ScoredFile = { path: string; content: string; score: number };

const JS_IMPORT = /\bfrom\s+["']([^"']+)["']/g;
const JS_SUFFIXES = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", "/index.ts", "/index.tsx", "/index.js"];
const PY_FROM = /^[ \t]*from[ \t]+(\.*)([\w.]*)[ \t]+import\b/gm;
const PY_IMPORT = /^[ \t]*import[ \t]+([\w.]+(?:[ \t]*,[ \t]*[\w.]+)*)/gm;
const PY_SUFFIXES = [".py", "/__init__.py"];
const GO_BLOCK = /^[ \t]*import[ \t]*\(([\s\S]*?)^[ \t]*\)/gm;
const GO_SINGLE = /^[ \t]*import[ \t]+(?:[._\w]+[ \t]+)?"([^"]+)"/gm;
const GO_QUOTED = /"([^"]+)"/g;
const JS_IMPORTED_NAMES = /\bimport\s+(?:type\s+)?\{([^}]*)\}/g;
const PY_IMPORTED_NAMES = /^[ \t]*from[ \t]+[\w.]+[ \t]+import[ \t]+([^\n(#]+)/gm;
const IMPORT_SOURCES = 3;
const MAX_IMPORTED = 3;
const GO_PACKAGE_FILES = 2;
const TS_CONFIG = "tsconfig.json";

const JS_FILE = /\.(?:[cm]?[jt]sx?|vue|svelte)$/;

const isBarrel = (path: string) => /(^|\/)(index\.[jt]sx?|__init__\.py)$/.test(path);
const directoryOf = (path: string) => path.split("/").slice(0, -1).join("/");

function findJavaScript(specifier: string, dir: string, paths: Set<string>, aliases?: AliasConfig): string[] {
  const bases = specifier.startsWith(".") ? [joinPath(dir, specifier)] : resolveAlias(specifier, aliases);
  const resolved = bases.flatMap((base) => JS_SUFFIXES.map((suffix) => base + suffix)).find((path) => paths.has(path));
  return resolved ? [resolved] : [];
}

function modulePath(module: string): string {
  return module.replaceAll(".", "/");
}

// Python imports name modules, so an absolute import may start below the repository root (`services.mail` in
// `src/services/mail.py`); the longest matching suffix is accepted when the exact path is absent.
function findPython(paths: Set<string>, base: string): string | null {
  const exact = PY_SUFFIXES.map((suffix) => base + suffix).find((path) => paths.has(path));
  if (exact) return exact;
  const suffix = `/${base}`;
  return [...paths].find((path) => PY_SUFFIXES.some((extension) => path.endsWith(`${suffix}${extension}`))) ?? null;
}

function resolvePythonImports(from: string, content: string, paths: Set<string>): string[] {
  const found: string[] = [];
  const add = (base: string) => {
    const resolved = base && findPython(paths, base);
    if (resolved) found.push(resolved);
  };
  for (const [, dots = "", module = ""] of content.matchAll(PY_FROM)) {
    const up = "../".repeat(Math.max(dots.length - 1, 0));
    const base = dots ? joinPath(directoryOf(from), `${up}${modulePath(module)}`) : modulePath(module);
    add(base);
  }
  for (const [, modules = ""] of content.matchAll(PY_IMPORT)) {
    for (const importedModule of modules.split(",")) add(modulePath(importedModule.trim()));
  }
  return found;
}

// Go imports name a package directory, and the module prefix (`github.com/acme/shop`) is not part of the tree.
function resolveGoImports(content: string, paths: Set<string>): string[] {
  const imports = [
    ...[...content.matchAll(GO_BLOCK)].flatMap(([, block = ""]) =>
      [...block.matchAll(GO_QUOTED)].map(([, path = ""]) => path),
    ),
    ...[...content.matchAll(GO_SINGLE)].map(([, path = ""]) => path),
  ];
  const files = [...paths].filter((path) => path.endsWith(".go") && !path.endsWith("_test.go"));
  const found = imports.flatMap((importPath) => {
    const directories = [
      ...new Set(files.map(directoryOf).filter((dir) => dir && (importPath === dir || importPath.endsWith(`/${dir}`)))),
    ];
    return directories.flatMap((dir) => files.filter((path) => path.startsWith(`${dir}/`)).slice(0, GO_PACKAGE_FILES));
  });
  return [...new Set(found)];
}

// Resolves relative and aliased imports against the repository's file list; packages are skipped.
function resolveImports(from: string, content: string, paths: Set<string>, aliases?: AliasConfig): string[] {
  if (from.endsWith(".py")) return resolvePythonImports(from, content, paths);
  if (from.endsWith(".go")) return resolveGoImports(content, paths);
  if (!JS_FILE.test(from)) return [];
  const dir = directoryOf(from);
  return [...content.matchAll(JS_IMPORT)].flatMap(([, specifier = ""]) =>
    findJavaScript(specifier, dir, paths, aliases),
  );
}

async function readAliases(paths: Set<string>, source: ContextSource): Promise<AliasConfig | undefined> {
  if (!paths.has(TS_CONFIG)) return undefined;
  try {
    return parseAliasConfig(await source.readFile(TS_CONFIG));
  } catch {
    return undefined;
  }
}

const importedName = (raw: string) => (raw.trim().split(/\s+as\s+/)[0] ?? "").replace(/[()]/g, "").trim().toLowerCase();

// Imported identifier → rank of the best-ranked file importing it.
function importedNames(files: ScoredFile[]): Map<string, number> {
  const ranks = new Map<string, number>();
  files.forEach((file, rank) => {
    for (const pattern of [JS_IMPORTED_NAMES, PY_IMPORTED_NAMES]) {
      for (const [, names = ""] of file.content.matchAll(pattern)) {
        for (const raw of names.split(",")) {
          const key = importedName(raw);
          if (key && !ranks.has(key)) ranks.set(key, rank);
        }
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
  const aliases = await readAliases(known, source);
  const seen = new Set(top.map((file) => file.path));
  const found: ImportedFile[] = [];
  let frontier = top.slice(0, IMPORT_SOURCES);
  // `import { sections } from "@/config/content"` points at content/sections.ts through the barrel.
  const names = importedNames(frontier);
  for (let hop = 0; hop < 2 && frontier.length; hop += 1) {
    const next = [
      ...new Set(frontier.flatMap((file) => resolveImports(file.path, file.content, known, aliases))),
    ].filter((path) => !seen.has(path) && (hop === 0 || !isBarrel(path)));
    next.forEach((path) => seen.add(path));
    const read = await Promise.all(
      next.map(async (path) => {
        const content = await source.readFile(path);
        const importerRank = names.get(baseName(path)) ?? IMPORT_SOURCES;
        const named = importerRank < IMPORT_SOURCES ? PATH_WEIGHT : 0;
        return { path, content, importerRank, score: scoreMatches(content.toLowerCase(), terms) + named };
      }),
    );
    found.push(...read.filter((file) => file.score > 0 && !isBarrel(file.path)));
    frontier = read.filter((file) => isBarrel(file.path));
  }
  return found.sort((a, b) => b.score - a.score || a.importerRank - b.importerRank).slice(0, MAX_IMPORTED);
}
