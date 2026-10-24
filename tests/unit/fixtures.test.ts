import { describe, expect, it } from "vitest";
import { evaluationCaseSchema } from "@/core/evaluation/fixtures";
import { first } from "@/lib/first";
import { fileExists, loadEvaluationCases, requestOf, trackerOf } from "../evaluation/fixtures";

const cases = loadEvaluationCases();

describe("evaluation fixtures", () => {
  it("has eight to ten cases with unique ids matching their directory", () => {
    expect(cases.length).toBeGreaterThanOrEqual(8);
    expect(cases.length).toBeLessThanOrEqual(10);
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
  });

  it.each(cases.map((c) => [c.id, c] as const))("%s: expected files exist", (_id, c) => {
    for (const file of c.expected.relevantFiles) expect(fileExists(c, file), file).toBe(true);
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
  it("returns the related issues retrieval searches", async () => {
    const c = first(
      cases.filter((c) => c.relatedIssues.length > 0),
      "case with related issues",
    );
    expect(await trackerOf(c).searchRelated(["export"], 5)).toEqual(c.relatedIssues);
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
