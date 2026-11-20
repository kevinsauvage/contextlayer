import { describe, expect, it } from "vitest";
import { cannedGenerator, firstFilesSelector } from "@/integrations/fake/generator";
import { fakeSourceProvider, fakeTrackerProvider } from "@/integrations/fake/providers";
import type { Evidence } from "@/core/evidence/schemas";

const evidence: Evidence[] = [
  {
    id: "e1",
    kind: "code",
    reference: "src/components/Banner.tsx",
    url: "https://tracker.invalid/blob/src/components/Banner.tsx",
    excerpt: '<h1 id="hero-title">Welcome to the shop</h1>',
  },
];

const draft = (request: string, candidates: Evidence[] = []) =>
  cannedGenerator.generate({ request, answers: [], candidates });

describe("cannedGenerator", () => {
  it("builds a title from the first line and cites the first candidate", async () => {
    const { body } = await draft("Change the banner title\nKeep the gradient", evidence);

    expect(body.title).toBe("Change the banner title");
    expect(body.description).toEqual([
      { text: "The change concerns `src/components/Banner.tsx`.", status: "verified", evidenceIds: ["e1"] },
    ]);
    expect(body.openQuestions).toEqual([]);
  });

  it("falls back to a placeholder title and an undecided claim without a source", async () => {
    const { body } = await draft("   \n");

    expect(body.title).toBe("Sample ticket");
    expect(body.description[0]?.status).toBe("needs_clarification");
  });

  it("truncates a long first line to a Jira-sized title", async () => {
    const { body } = await draft("x".repeat(200));
    expect(body.title).toHaveLength(80);
  });

  it("answers an audit with a summary and a proposed ticket", async () => {
    const result = await cannedGenerator.audit({
      issue: { key: "SHOP-1", summary: "Banner", description: "", status: "To Do", url: "u" },
      candidates: evidence,
    });

    expect(result.body.summary).toBe("Sample audit.");
    expect(result.body.findings).toEqual([]);
    expect(result.body.proposedTicket.title).toBe("Banner");
  });
});

describe("firstFilesSelector", () => {
  it("selects the first two files of the source", async () => {
    const source = {
      revision: "abc",
      listFiles: async () => ["a.ts", "b.ts", "c.ts"],
      readFile: async () => "",
      searchContent: async () => ({ paths: [], failedTerms: [] }),
    };
    await expect(firstFilesSelector.select({ source, query: "x" })).resolves.toEqual({
      paths: ["a.ts", "b.ts"],
    });
  });
});

describe("fake providers", () => {
  it("exposes one repository and one tracker project without credentials", async () => {
    expect(fakeSourceProvider.isConfigured()).toBe(true);
    expect(fakeTrackerProvider.isConfigured()).toBe(true);
    await expect(fakeSourceProvider.listResources({} as never)).resolves.toEqual([
      { id: "sample/shop", label: "sample/shop" },
    ]);
    await expect(fakeTrackerProvider.listResources({} as never)).resolves.toEqual([
      { id: "SHOP", label: "SHOP · Sample shop" },
    ]);
  });

  it("reads the sample files and reports a missing one", async () => {
    const source = await fakeSourceProvider.openSource({} as never, "sample/shop");

    expect(await source.listFiles()).toEqual(["src/components/Banner.tsx", "src/cart/total.ts", "README.md"]);
    await expect(source.readFile("src/cart/total.ts")).resolves.toContain("Math.floor");
    await expect(source.readFile("missing.ts")).rejects.toThrow("No such file: missing.ts");
  });

  it("searches file contents by term", async () => {
    const source = await fakeSourceProvider.openSource({} as never, "sample/shop");
    if (!source.searchContent) throw new Error("the sample source should search content");
    const result = await source.searchContent(["banner", "nothing"]);

    expect(result.paths).toEqual(["src/components/Banner.tsx"]);
    expect(result.failedTerms).toEqual([]);
  });

  it("creates, reads, searches and updates issues in memory", async () => {
    const tracker = fakeTrackerProvider.openTracker({} as never, "SHOP");
    const draftBody = {
      title: "Fix the banner",
      description: [{ text: "Banner text", status: "inferred" as const, evidenceIds: [] }],
      acceptanceCriteria: [],
      assumptions: [],
      openQuestions: [],
      evidence: [],
    };

    const created = await tracker.createIssue(draftBody);
    expect(created.key).toMatch(/^SHOP-\d+$/);
    expect(created.url).toBe(`https://tracker.invalid/browse/${created.key}`);
    await expect(tracker.getIssue(created.key)).resolves.toMatchObject({ summary: "Fix the banner" });
    await expect(tracker.searchRelated(["fix"], 5)).resolves.toEqual([expect.objectContaining({ key: created.key })]);

    await expect(
      tracker.updateIssue(created.key, { ...draftBody, title: "Fix the banner again" }),
    ).resolves.toMatchObject({
      key: created.key,
    });
    await expect(tracker.getIssue(created.key)).resolves.toMatchObject({ summary: "Fix the banner again" });
    await expect(tracker.getIssue("SHOP-9999")).rejects.toThrow("No such issue: SHOP-9999");
    await expect(tracker.updateIssue("SHOP-9999", draftBody)).rejects.toThrow("No such issue: SHOP-9999");
  });

  it("normalizes issue keys and builds the example", () => {
    expect(fakeTrackerProvider.parseIssueKey("SHOP", " shop-12 ")).toBe("SHOP-12");
    expect(fakeTrackerProvider.parseIssueKey("SHOP", "OTHER-1")).toBeNull();
    expect(fakeTrackerProvider.issueKeyExample("SHOP")).toBe("SHOP-1");
  });
});
