import { describe, expect, it } from "vitest";
import { evaluationCaseSchema } from "@/core/evaluation/fixtures";
import { first } from "@/lib/first";
import { fileExists, loadEvaluationCases, requestOf, trackerOf } from "../evaluation/fixtures";

const cases = loadEvaluationCases();

describe("evaluation fixtures", () => {
  it("has at least eight cases (C3) with unique ids matching their directory", () => {
    expect(cases.length).toBeGreaterThanOrEqual(8);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    for (const c of cases) expect(c.dir.endsWith(c.id)).toBe(true);
  });

  it("labels every case with a short title and a full request", () => {
    for (const c of cases) {
      expect(c.title.length, c.id).toBeLessThanOrEqual(120);
      expect(requestOf(c).length, c.id).toBeGreaterThan(2);
    }
  });

  it("gives audit cases the issue to audit", () => {
    for (const c of cases.filter((c) => c.kind === "audit")) expect(c.issue, c.id).toBeDefined();
  });

  it("covers an audit, a related issue, a clarification round, an injection and a control", () => {
    expect(cases.some((c) => c.kind === "audit")).toBe(true);
    expect(cases.some((c) => c.relatedIssues.length > 0)).toBe(true);
    expect(cases.some((c) => c.answers.length > 0)).toBe(true);
    expect(cases.some((c) => c.tags.includes("injection"))).toBe(true);
    expect(cases.some((c) => c.tags.includes("control"))).toBe(true);
    // Injected text reaches the prompt through the tracker too, not only through repository files.
    expect(cases.some((c) => c.kind === "audit" && c.tags.includes("injection"))).toBe(true);
  });

  it.each(cases.map((c) => [c.id, c] as const))("%s: expected files exist", (_id, c) => {
    for (const file of c.expected.relevantFiles) expect(fileExists(c, file), file).toBe(true);
  });

  it("measures retrieval on large checkouts and on a copied repository", () => {
    const retrieval = cases.filter((c) => c.kind === "retrieval");
    expect(retrieval.length).toBeGreaterThanOrEqual(5);
    // Large cases read a pinned commit; a small copied repo needs none.
    for (const c of retrieval.filter((c) => c.tags.includes("large")))
      expect(c.repository?.commit, c.id).toMatch(/^[0-9a-f]{40}$/);
    expect(
      retrieval.some((c) => !c.repository),
      "a copied repo case",
    ).toBe(true);
    // One request in another language: stopwords and term extraction differ from the English fixtures.
    expect(retrieval.some((c) => c.tags.includes("french"))).toBe(true);
  });

  it("refuses an audit case without the issue to audit", () => {
    const expected = {
      relevantFiles: ["repo/a.ts"],
      verifiedFacts: ["a fact"],
      mustStayUncertain: ["a point"],
      forbiddenClaims: ["a claim"],
    };
    expect(() => evaluationCaseSchema.parse({ id: "x", kind: "audit", title: "T", expected })).toThrow();
    expect(() => evaluationCaseSchema.parse({ id: "x", kind: "create", title: "T", expected })).not.toThrow();
  });
});

describe("fixture tracker", () => {
  const withRelated = first(
    cases.filter((c) => c.relatedIssues.some((issue) => issue.summary.toLowerCase().includes("export"))),
    "case with a related export issue",
  );

  it("returns the related issues the query's terms match", async () => {
    expect(await trackerOf(withRelated).searchRelated(["export"], 5)).toEqual(withRelated.relatedIssues);
  });

  // Production searches an index, so an unrelated query finds nothing; returning the issue anyway would make the
  // duplicate exists/does not exist distinction unmeasurable.
  it("returns nothing when no issue matches the terms, and honors the limit", async () => {
    expect(await trackerOf(withRelated).searchRelated(["kubernetes"], 5)).toEqual([]);
    expect(await trackerOf(withRelated).searchRelated(["export"], 0)).toEqual([]);
  });

  it("returns the audited issue and refuses unknown keys", async () => {
    const c = first(
      cases.filter((c) => c.kind === "audit"),
      "audit case",
    );
    const tracker = trackerOf(c);
    expect(await tracker.getIssue(c.issue?.key ?? "")).toEqual(c.issue);
    await expect(tracker.getIssue("NOPE-1")).rejects.toThrow();
  });
});
