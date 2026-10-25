import { describe, expect, it } from "vitest";
import type { TrackerProvider } from "@/core/integrations/provider";
import { startConnect } from "@/features/integrations/oauth-flow";
import type { OrgContext } from "@/infrastructure/auth/session";
import { verifyState } from "@/infrastructure/signed-state";

const context = (isAdmin = true): OrgContext => ({
  userId: "u1",
  organizationId: "orgA",
  role: isAdmin ? "owner" : "member",
  isAdmin,
  user: { name: "U", email: "u@x.test" },
});

type AuthorizeArgs = Parameters<TrackerProvider["authorizeUrl"]>[0];

function provider(configured = true) {
  const calls: AuthorizeArgs[] = [];
  const fake: TrackerProvider = {
    id: "jira",
    name: "Jira Cloud",
    kind: "tracker",
    description: "Tracker",
    accountNoun: "site",
    resourceNoun: "project",
    canAddAccount: false,
    exclusive: false,
    isConfigured: () => configured,
    authorizeUrl: (args) => {
      calls.push(args);
      return "https://jira.test/authorize";
    },
    complete: async () => ({ status: "cancelled" }),
    listResources: async () => [],
    openTracker: () => {
      throw new Error("unused");
    },
    parseIssueKey: () => null,
    issueKeyExample: () => "SHOP-1",
  };
  return { fake, calls };
}

const notice = (url: string) => {
  const parsed = new URL(url);
  return { origin: parsed.origin, path: parsed.pathname, result: parsed.searchParams.get("result") };
};

describe("startConnect", () => {
  it("sends a member back with not_admin, without starting OAuth", () => {
    const { fake, calls } = provider();

    expect(notice(startConnect(fake, context(false), { add: false, returnTo: "/projects/new" }))).toEqual({
      origin: "http://localhost:3000",
      path: "/projects/new",
      result: "not_admin",
    });
    expect(calls).toEqual([]);
  });

  it("reports a provider this server has no credentials for", () => {
    const { fake, calls } = provider(false);

    expect(notice(startConnect(fake, context(), { add: false, returnTo: null }))).toMatchObject({
      path: "/settings/integrations",
      result: "unconfigured",
    });
    expect(calls).toEqual([]);
  });

  it("signs a state that verifies back to the same user, organization, provider and return path", () => {
    const { fake, calls } = provider();

    expect(startConnect(fake, context(), { add: true, returnTo: "/projects/new" })).toBe("https://jira.test/authorize");
    const [call] = calls;
    expect(call).toMatchObject({ add: true, redirectUri: "http://localhost:3000/api/integrations/jira/callback" });
    expect(verifyState(call?.state ?? null)).toMatchObject({
      userId: "u1",
      organizationId: "orgA",
      provider: "jira",
      returnTo: "/projects/new",
    });
  });

  it.each(["https://evil.test/steal", "//evil.test", "/\\evil.test"])(
    "replaces the unsafe return path %s",
    (returnTo) => {
      const { fake, calls } = provider();
      startConnect(fake, context(), { add: false, returnTo });

      expect(verifyState(calls[0]?.state ?? null)?.returnTo).toBe("/settings/integrations");
    },
  );
});
