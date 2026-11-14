import { describe, expect, it } from "vitest";
import type { ProviderOverview } from "@/features/integrations/overview";
import { setupSteps } from "@/features/integrations/setup";

const provider = (id: string, kind: "source" | "tracker", connected = false, configured = true) =>
  ({ id, kind, name: id, configured, connections: connected ? [{ id: "c1" }] : [] }) as unknown as ProviderOverview;

const hrefs = (overview: ProviderOverview[]) => setupSteps(overview, "/projects").map((step) => step.href);

describe("setupSteps", () => {
  it("starts the consent directly and returns to the checklist while another connection is missing", () => {
    expect(hrefs([provider("github", "source"), provider("jira", "tracker")])).toEqual([
      "/api/integrations/github/connect?returnTo=%2Fprojects",
      "/api/integrations/jira/connect?returnTo=%2Fprojects",
      "/projects/new",
    ]);
  });

  it("returns from the last missing connection straight to the new project form", () => {
    const steps = setupSteps([provider("github", "source", true), provider("jira", "tracker")], "/projects");

    expect(steps.map((step) => step.done)).toEqual([true, false, false]);
    expect(steps[1]?.href).toBe("/api/integrations/jira/connect?returnTo=%2Fprojects%2Fnew");
  });

  it("sends the choice to the integrations page when no single provider is configured", () => {
    expect(
      hrefs([provider("github", "source"), provider("gitlab", "source"), provider("jira", "tracker", false, false)]),
    ).toEqual(["/settings/integrations", "/settings/integrations", "/projects/new"]);
  });
});
