import { describe, expect, it } from "vitest";
import { connectNotice } from "@/features/integrations/notices";
import { FLASH_MESSAGES, isFlashKey, withFlash } from "@/lib/flash";

describe("connectNotice", () => {
  it.each(["connected", "taken", "no_account", "forbidden"] as const)(
    "tells a person who got the wrong account how to switch (%s)",
    (result) => {
      const { title, detail } = connectNotice(result, "GitHub");

      expect(title).toContain("GitHub");
      expect(detail).toMatch(/switch (account|to)/i);
      expect(detail).toContain("connect again");
    },
  );

  it("says nothing changed when the connection did not happen", () => {
    expect(connectNotice("cancelled", "Jira").detail).toContain("Nothing was changed");
    expect(connectNotice("failed", "Jira").detail).toContain("Nothing was changed");
  });
});

describe("flash messages", () => {
  it("adds the key to a path with or without a query", () => {
    expect(withFlash("/projects", "project_deleted")).toBe("/projects?notice=project_deleted");
    expect(withFlash("/projects?tab=1", "project_deleted")).toBe("/projects?tab=1&notice=project_deleted");
  });

  it("accepts only listed keys, so a link cannot write its own message", () => {
    expect(isFlashKey("project_created")).toBe(true);
    expect(isFlashKey("<b>hello</b>")).toBe(false);
    expect(isFlashKey("toString")).toBe(false);
    expect(isFlashKey(null)).toBe(false);
    expect(Object.keys(FLASH_MESSAGES)).toContain("organization_left");
  });
});
