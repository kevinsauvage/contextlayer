import { describe, expect, it } from "vitest";
import { safePath } from "@/lib/safe-path";

const safe = (value: string | null | undefined) => safePath(value, "/fallback");

describe("safePath", () => {
  it("keeps a same-origin path with its query and hash", () => {
    expect(safe("/projects/1?tab=history#run")).toBe("/projects/1?tab=history#run");
  });

  it.each(["/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/\\evil.com", "//evil.com", "https://evil.com"])(
    "rejects %j",
    (value) => {
      expect(safe(value)).toBe("/fallback");
    },
  );

  it("normalizes a same-origin path that walks up", () => {
    expect(safe("/a/../projects")).toBe("/projects");
  });

  it("falls back for a missing value", () => {
    expect(safe(undefined)).toBe("/fallback");
    expect(safe(null)).toBe("/fallback");
    expect(safe("")).toBe("/fallback");
  });
});
