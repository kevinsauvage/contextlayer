import { z } from "zod";

export function joinPath(dir: string, relativePath: string): string {
  const parts: string[] = [];
  for (const part of `${dir}/${relativePath}`.split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}

export type AliasConfig = { baseUrl: string; paths: { pattern: string; targets: string[] }[] };

const TS_CONFIG = z.object({
  compilerOptions: z
    .object({
      baseUrl: z.string().optional(),
      paths: z.record(z.string(), z.array(z.string())).optional(),
    })
    .optional(),
});

const DEFAULT_ALIAS = /^[@~]\//;

// tsconfig.json allows comments and trailing commas, which JSON.parse rejects.
function parseJsonc(text: string): unknown {
  let stripped = "";
  let inString = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";
    const next = text[index + 1] ?? "";
    if (inString) {
      stripped += char;
      if (char === "\\") {
        stripped += next;
        index += 1;
      } else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      stripped += char;
    } else if (char === "/" && next === "/") {
      while (index < text.length && text[index] !== "\n") index += 1;
    } else if (char === "/" && next === "*") {
      index += 2;
      while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) index += 1;
      index += 1;
    } else if (char === ",") {
      let ahead = index + 1;
      while (/\s/.test(text[ahead] ?? "")) ahead += 1;
      if (text[ahead] !== "}" && text[ahead] !== "]") stripped += char;
    } else {
      stripped += char;
    }
  }
  return JSON.parse(stripped);
}

// Returns undefined when the file is absent, invalid, or declares no `paths`, since the defaults still apply.
export function parseAliasConfig(text: string): AliasConfig | undefined {
  let raw: unknown;
  try {
    raw = parseJsonc(text);
  } catch {
    return undefined;
  }
  const parsed = TS_CONFIG.safeParse(raw);
  if (!parsed.success) return undefined;
  const { baseUrl, paths } = parsed.data.compilerOptions ?? {};
  if (!paths) return undefined;
  return {
    baseUrl: baseUrl ?? ".",
    paths: Object.entries(paths).map(([pattern, targets]) => ({ pattern, targets })),
  };
}

// `compilerOptions.paths` first, then the `@/` and `~/` conventions this codebase ships with.
export function resolveAlias(specifier: string, config?: AliasConfig): string[] {
  const stripped = specifier.slice(2);
  const defaults = DEFAULT_ALIAS.test(specifier) ? [`src/${stripped}`, stripped] : [];
  return [...(config ? configuredTargets(specifier, config) : []), ...defaults];
}

function configuredTargets(specifier: string, config: AliasConfig): string[] {
  return config.paths
    .flatMap(({ pattern, targets }) => {
      const star = pattern.indexOf("*");
      if (star === -1) return pattern === specifier ? targets : [];
      const prefix = pattern.slice(0, star);
      const suffix = pattern.slice(star + 1);
      const fits =
        specifier.length >= prefix.length + suffix.length && specifier.startsWith(prefix) && specifier.endsWith(suffix);
      if (!fits) return [];
      const matched = specifier.slice(prefix.length, specifier.length - suffix.length);
      return targets.map((target) => target.replace("*", matched));
    })
    .map((target) => joinPath(config.baseUrl, target));
}
