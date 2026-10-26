import { describe, expect, it } from "vitest";
import { retrieveFileEvidence } from "@/core/context/retrieve";
import { extractTerms, mergeTerms } from "@/core/context/terms";
import { DirectorySource } from "@/integrations/filesystem/directory-source";
import { first } from "@/lib/first";
import { loadEvaluationCases, requestOf } from "../evaluation/fixtures";

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

  it("drops instruction words that answers tend to add", () => {
    expect(extractTerms("find the current line, other colors")).toEqual(["colors"]);
  });

  it("expands theme and performance wording", () => {
    expect(extractTerms("add dark mode")).toEqual(["dark", "mode", "theme", "scheme", "color"]);
    expect(extractTerms("the site is too slow on mobile")).toEqual([
      "slow",
      "mobile",
      "performance",
      "latency",
      "responsive",
      "viewport",
    ]);
  });
});

describe("mergeTerms", () => {
  it("appends model terms after the request's own and drops duplicates and unusable values", () => {
    expect(mergeTerms(["reset", "password"], ["Reset", "mailer", "`sendMail`", "two words", "", "mailer"])).toEqual([
      "reset",
      "password",
      "mailer",
      "sendmail",
    ]);
  });

  it("caps how many expanded terms it adds", () => {
    expect(
      mergeTerms(
        ["reset"],
        Array.from({ length: 12 }, (_, i) => `term${i}`),
      ),
    ).toHaveLength(9);
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

describe("ranking search hits", () => {
  it("reads hits in provider order and keeps the one whose content matches, not the alphabetically first", async () => {
    const noise = Array.from({ length: 25 }, (_, i) => `src/a${i.toString().padStart(2, "0")}.ts`);
    const target = "src/styles/globals.css";
    const searchHits = [...noise.slice(0, 10), target, ...noise.slice(10)];
    const files: Record<string, string> = {
      [target]: "--color-primary-500: #22c55e;",
      ...Object.fromEntries(noise.map((path) => [path, "export const value = 1;"])),
    };
    const source = {
      listFiles: async () => Object.keys(files),
      readFile: async (path: string) => files[path] ?? "",
      searchContent: async () => searchHits,
    };

    const found = await retrieveFileEvidence(["primary"], source);
    expect(found[0]?.reference).toBe(target);
  });

  it("prefers repeated mentions over a single class name", async () => {
    const files: Record<string, string> = {
      "src/components/Badge.tsx": "export const Badge = () => <span className='text-primary-400' />;",
      "src/styles/globals.css": "--color-primary-500: #22c55e;\n".repeat(5),
    };
    const source = {
      listFiles: async () => Object.keys(files),
      readFile: async (path: string) => files[path] ?? "",
      searchContent: async () => Object.keys(files),
    };

    const found = await retrieveFileEvidence(["primary"], source);
    expect(found[0]?.reference).toBe("src/styles/globals.css");
  });

  it("drops a search hit whose content does not contain the terms", async () => {
    const files: Record<string, string> = {
      "src/a.ts": "export const value = 1;",
      "src/b.ts": "export const other = 2;",
    };
    const source = {
      listFiles: async () => Object.keys(files),
      readFile: async (path: string) => files[path] ?? "",
      // GitHub tokenises differently from the substring check: the hit names no usable line.
      searchContent: async () => ["src/a.ts"],
    };

    expect(await retrieveFileEvidence(["primary"], source)).toEqual([]);
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

  it("reaches copy behind a tsconfig alias in the banner fixture", async () => {
    const c = first(
      loadEvaluationCases().filter((c) => c.id === "banner-title"),
      "banner fixture",
    );
    const found = await retrieveFileEvidence(extractTerms(requestOf(c)), new DirectorySource(c.repoDir));
    expect(found.map((e) => `repo/${e.reference}`)).toContain("repo/src/content/site.ts");
  });

  it("follows a Python relative import to the module that implements the change", async () => {
    const files: Record<string, string> = {
      "src/reset/handler.py": `from ..services.mail import send_reset\n\ndef handle():\n    return send_reset()`,
      "src/services/mail.py": `def send_reset():\n    return "token"`,
    };
    const found = await retrieveFileEvidence(extractTerms("password reset"), {
      listFiles: async () => Object.keys(files),
      readFile: async (path) => files[path] ?? "",
    });
    expect(found.map((e) => e.reference)).toContain("src/services/mail.py");
  });

  it("follows an absolute Python import that starts below the repository root", async () => {
    const files: Record<string, string> = {
      "src/reset/job.py": `from services.mail import send_reset\n\ndef run():\n    return send_reset()`,
      "src/services/mail.py": `def send_reset():\n    return "token"`,
    };
    const found = await retrieveFileEvidence(extractTerms("password reset queued job"), {
      listFiles: async () => Object.keys(files),
      readFile: async (path) => files[path] ?? "",
    });
    expect(found.map((e) => e.reference)).toContain("src/services/mail.py");
  });

  it("follows a Go package import even though the module prefix is not in the tree", async () => {
    const files: Record<string, string> = {
      "internal/reset/handler.go": `package reset\n\nimport (\n\t"fmt"\n\t"github.com/acme/shop/internal/mail"\n)\n\nfunc Handle() { fmt.Println(mail.SendReset()) }`,
      "internal/mail/send.go": `package mail\n\nfunc SendReset() {}`,
    };
    const found = await retrieveFileEvidence(extractTerms("password reset"), {
      listFiles: async () => Object.keys(files),
      readFile: async (path) => files[path] ?? "",
    });
    expect(found.map((e) => e.reference)).toContain("internal/mail/send.go");
  });
});

describe("resolving aliases", () => {
  const retrieve = (files: Record<string, string>) =>
    retrieveFileEvidence(extractTerms("Change the hero title"), {
      listFiles: async () => Object.keys(files),
      readFile: async (path: string) => files[path] ?? "",
    });

  it("follows the repository tsconfig paths instead of assuming @/ means src/", async () => {
    const found = await retrieve({
      "tsconfig.json": `{
        // a monorepo keeps the app in packages, not src
        "compilerOptions": { "baseUrl": ".", "paths": { "~/*": ["./packages/ui/*"] } },
      }`,
      "app/Hero.tsx": `import { hero } from "~/content/site";\nexport const Hero = () => hero.title;`,
      "packages/ui/content/site.ts": `export const hero = { title: "Frontend engineer" };`,
    });
    expect(found.map((e) => e.reference)).toContain("packages/ui/content/site.ts");
  });

  it("resolves paths against compilerOptions.baseUrl", async () => {
    const found = await retrieve({
      "tsconfig.json": `{ "compilerOptions": { "baseUrl": "src", "paths": { "#/*": ["modules/*"] } } }`,
      "src/Hero.tsx": `import { hero } from "#/content/site";\nexport const Hero = () => hero.title;`,
      "src/modules/content/site.ts": `export const hero = { title: "Frontend engineer" };`,
    });
    expect(found.map((e) => e.reference)).toContain("src/modules/content/site.ts");
  });

  it("keeps the @/ and ~/ defaults when tsconfig declares no paths", async () => {
    const found = await retrieve({
      "tsconfig.json": `{ "compilerOptions": { "strict": true } }`,
      "app/Hero.tsx": `import { hero } from "@/content/site";\nexport const Hero = () => hero.title;`,
      "src/content/site.ts": `export const hero = { title: "Frontend engineer" };`,
    });
    expect(found.map((e) => e.reference)).toContain("src/content/site.ts");
  });
});
