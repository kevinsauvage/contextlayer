import { describe, expect, it } from "vitest";
import { jqlString } from "@/integrations/jira/client";

describe("JQL literals", () => {
  it("quotes plain values", () => {
    expect(jqlString("SHOP")).toBe('"SHOP"');
    expect(jqlString("hello world")).toBe('"hello world"');
  });

  it("escapes quotes and backslashes", () => {
    expect(jqlString('say "hi"')).toBe('"say \\"hi\\""');
    expect(jqlString("back\\slash")).toBe('"back\\\\slash"');
  });
});
