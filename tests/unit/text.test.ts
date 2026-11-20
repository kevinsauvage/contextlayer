import { describe, expect, it } from "vitest";
import { textOr } from "@/lib/text";

describe("textOr", () => {
  it("keeps a message with text", () => {
    expect(textOr("Invalid password", "Try again")).toBe("Invalid password");
  });

  it("falls back for a missing, empty or blank message", () => {
    expect(textOr(undefined, "Try again")).toBe("Try again");
    expect(textOr(null, "Try again")).toBe("Try again");
    expect(textOr("", "Try again")).toBe("Try again");
    expect(textOr("  ", "Try again")).toBe("Try again");
  });
});
