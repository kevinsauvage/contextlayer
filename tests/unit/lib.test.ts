import { describe, expect, it } from "vitest";
import { asRoute } from "@/components/as-route";
import { countLabel } from "@/lib/count";
import { first } from "@/lib/first";
import { formString } from "@/lib/form";
import { isUuid } from "@/lib/uuid";
import { firstIssueMessage } from "@/lib/zod";
import { z } from "zod";

describe("countLabel", () => {
  it("carries the verb agreement of the counted phrase", () => {
    expect(countLabel(0, "claim needs", "claims need")).toBe("0 claims need");
    expect(countLabel(1, "claim needs", "claims need")).toBe("1 claim needs");
    expect(countLabel(2, "claim needs", "claims need")).toBe("2 claims need");
  });
});

describe("first", () => {
  it("returns the first item and names what was missing", () => {
    expect(first([1, 2])).toBe(1);
    expect(first(["a"])).toBe("a");
    expect(() => first([])).toThrow("Expected at least one item");
    expect(() => first([], "organization")).toThrow("Expected at least one organization");
  });
});

describe("formString", () => {
  it("reads string fields and treats files or missing fields as empty", () => {
    const data = new FormData();
    data.set("name", "Shop");
    data.set("file", new File(["x"], "x.txt"));

    expect(formString(data, "name")).toBe("Shop");
    expect(formString(data, "file")).toBe("");
    expect(formString(data, "missing")).toBe("");
  });
});

describe("isUuid", () => {
  it("accepts canonical ids and rejects anything Postgres would fail to cast", () => {
    expect(isUuid("8b1e1f4e-6c0b-4a4b-9f2e-3b5d7c9a1e2f")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid("8b1e1f4e-6c0b-4a4b-9f2e")).toBe(false);
  });
});

describe("firstIssueMessage", () => {
  it("returns the first schema message, or the fallback when there is none", () => {
    const parsed = z.string().min(3, "Too short").safeParse("x");
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(firstIssueMessage(parsed.error)).toBe("Too short");
      expect(firstIssueMessage(parsed.error, "Invalid input")).toBe("Too short");
    }
    expect(firstIssueMessage(new z.ZodError([]), "The draft is invalid")).toBe("The draft is invalid");
  });
});

describe("asRoute", () => {
  it("keeps a runtime path as a typed route", () => {
    expect(asRoute("/projects/abc?tab=1")).toBe("/projects/abc?tab=1");
  });
});
