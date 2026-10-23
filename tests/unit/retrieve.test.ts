import { describe, expect, it } from "vitest";
import { extractTerms, retrieveFileEvidence } from "@/core/context/retrieve";
import { DirectorySource } from "@/integrations/filesystem/directory-source";
import { first } from "@/lib/first";
import { loadEvaluationCases } from "../evaluation/fixtures";

describe("extractTerms", () => {
  it("drops stopwords and short words and dedupes", () => {
    expect(extractTerms("Improve the checkout checkout UI")).toEqual(["checkout"]);
  });

  it("ignores the quoted new value and accents, and adds UI synonyms", () => {
    expect(extractTerms(`Change the banner title to "Hello, I'm Kévin Sauvage"`)).toEqual([
      "banner",
      "title",
      "hero",
      "header",
      "heading",
      "headline",
    ]);
    expect(extractTerms("Rename Kévin's café")).toEqual(["kevin", "cafe"]);
  });

  it("keeps the most frequent terms when capped", () => {
    expect(extractTerms("alpha beta beta gamma gamma gamma", 2)).toEqual(["gamma", "beta"]);
  });
});

describe("retrieveContext on fixtures", () => {
  it.each(loadEvaluationCases().map((c) => [c.id, c] as const))(
    "%s: finds at least one expected file",
    async (_id, c) => {
      const found = await retrieveFileEvidence(extractTerms(c.title), new DirectorySource(c.repoDir));
      const references = found.map((e) => `repo/${e.reference}`);
      expect(c.expected.relevantFiles.some((f) => references.includes(f))).toBe(true);
    },
  );

  it("returns an empty list when nothing matches", async () => {
    const c = first(loadEvaluationCases(), "evaluation case");
    expect(await retrieveFileEvidence(extractTerms("zzzxqy"), new DirectorySource(c.repoDir))).toEqual([]);
  });
});

describe("following imports", () => {
  const files: Record<string, string> = {
    "src/components/Hero.tsx": `import { layout, sections } from "@/config/content";\nexport const Hero = () => sections.hero.title;`,
    "src/components/CookieBanner.tsx": `import { cookies } from "@/config/content";\nexport const banner = cookies.banner.title;`,
    "src/config/content/index.ts": `export * from "./sections";\nexport * from "./layout";\nexport * from "./faq";`,
    "src/config/content/sections.ts": `export const sections = { hero: { title: "Frontend engineer" } };`,
    "src/config/content/layout.ts": `export const layout = { footer: "Made with care" };`,
    "src/config/content/faq.ts": `export const faq = { title: "Questions", hero: false };`,
  };
  const source = { listFiles: async () => Object.keys(files), readFile: async (path: string) => files[path] ?? "" };

  it("finds the content module a matching component imports through a barrel", async () => {
    const found = await retrieveFileEvidence(extractTerms("Change the banner title"), source);
    const references = found.map((e) => e.reference);
    expect(references).toContain("src/components/Hero.tsx");
    expect(references).toContain("src/config/content/sections.ts");
    expect(references).not.toContain("src/config/content/index.ts");
  });
});
