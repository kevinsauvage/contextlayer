import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.join(import.meta.dirname, "..", "..", "src");

type Rule = {
  // Layers this layer may import (relative imports stay inside the layer).
  layers: string[];
  // When set, a package import must be one of these.
  packages?: string[];
  // Narrower exceptions inside a layer entry: target path prefix -> allowed prefixes.
  paths?: Record<string, string[]>;
};

const RULES: Record<string, Rule> = {
  // stopword is a pure word list, so it does not break the "no I/O in core" intent.
  core: { layers: ["core"], packages: ["zod", "stopword"] },
  lib: { layers: ["lib"], packages: ["cn", "zod"] },
  infrastructure: { layers: ["core", "infrastructure", "lib"] },
  integrations: { layers: ["core", "infrastructure", "integrations", "lib"] },
  features: { layers: ["core", "features", "infrastructure", "integrations", "lib"] },
  components: {
    layers: ["components", "core", "features", "lib"],
    paths: { infrastructure: ["infrastructure/auth/client"] },
  },
  app: { layers: ["app", "components", "core", "features", "infrastructure", "lib"] },
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

const layerOf = (file: string) => path.relative(SRC, file).split(path.sep)[0] ?? "";
const packageOf = (specifier: string) =>
  specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : (specifier.split("/")[0] ?? "");

function violations(): string[] {
  const problems: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const from = layerOf(file);
    const rule = RULES[from];
    // Root files (next.config.ts, proxy.ts) are wiring and follow no layer rule.
    if (!rule) continue;
    const content = readFileSync(file, "utf8");
    const relative = path.relative(SRC, file).replaceAll(path.sep, "/");
    const specifiers = [
      ...content.matchAll(/^(?:import|export)[^;]*?from\s+["']([^"']+)["']/gms),
      ...content.matchAll(/^import\s+["']([^"']+)["']/gms),
    ].map(([, specifier = ""]) => specifier);
    for (const specifier of specifiers) {
      if (specifier.startsWith(".")) continue;
      if (specifier.startsWith("node:")) {
        if (from === "core" || from === "lib")
          problems.push(`${relative}: ${from} must stay free of Node I/O (${specifier})`);
        continue;
      }
      if (specifier.startsWith("@/")) {
        const target = specifier.split("/")[1] ?? "";
        const exceptions = rule.paths?.[target];
        if (target === from || rule.layers.includes(target) || exceptions) {
          if (
            exceptions &&
            !exceptions.some((prefix) => specifier === `@/${prefix}` || specifier.startsWith(`@/${prefix}/`))
          )
            problems.push(`${relative}: ${from} may only reach @/${target} through ${exceptions.join(", ")}`);
          continue;
        }
        problems.push(`${relative}: ${from} must not import @/${target}`);
        continue;
      }
      if (rule.packages && !rule.packages.includes(packageOf(specifier)))
        problems.push(`${relative}: ${from} may only use ${rule.packages.join(", ")} (imported ${specifier})`);
    }
  }
  return problems;
}

describe("architecture", () => {
  it("keeps every layer inside its documented dependency rules", () => {
    expect(violations()).toEqual([]);
  });
});
