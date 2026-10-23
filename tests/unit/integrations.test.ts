import { describe, expect, it } from "vitest";
import { connectHref, connectNoticeUrl, readConnectNotice } from "@/features/integrations/notices";
import { selectGithubAccounts } from "@/integrations/github/provider";
import { parseJiraIssueKey } from "@/integrations/jira/provider";
import { safePath } from "@/lib/safe-path";

describe("GitHub account selection", () => {
  const accounts = [
    { installationId: 99, accountLogin: "acme" },
    { installationId: 100, accountLogin: "acme-org" },
  ];
  const select = (installationId?: number, available = accounts) =>
    selectGithubAccounts(available, installationId, "https://github.com/install");

  it("links every installation the user can access when none is specified", () => {
    const result = select();
    expect(result.status === "connected" && result.accounts.map((a) => a.externalId)).toEqual(["99", "100"]);
  });

  it("links only the requested installation and refuses ids the user cannot access", () => {
    const result = select(100);
    expect(result.status === "connected" && result.accounts.map((a) => a.label)).toEqual(["acme-org"]);
    expect(select(12345)).toEqual({ status: "forbidden" });
  });

  it("sends a user without installations to the install page", () => {
    expect(select(undefined, [])).toEqual({ status: "redirect", url: "https://github.com/install" });
  });
});

describe("Jira issue keys", () => {
  it.each([
    ["SHOP-12", "SHOP-12"],
    [" shop-12 ", "SHOP-12"],
    ["https://acme.atlassian.net/browse/SHOP-12?focus=1", "SHOP-12"],
  ])("accepts %s", (input, key) => expect(parseJiraIssueKey("SHOP", input)).toBe(key));

  it.each(["OTHER-1", "SHOP-", "SHOP-1a", ""])("rejects %s", (input) =>
    expect(parseJiraIssueKey("SHOP", input)).toBeNull(),
  );
});

describe("redirect safety", () => {
  it("keeps same-origin paths only", () => {
    expect(safePath("/projects/new", "/x")).toBe("/projects/new");
    expect(safePath("//evil.test", "/x")).toBe("/x");
    expect(safePath("/\\evil.test", "/x")).toBe("/x");
    expect(safePath("https://evil.test", "/x")).toBe("/x");
    expect(safePath(null, "/x")).toBe("/x");
  });
});

describe("connect notices", () => {
  it("round-trips through the return URL and keeps existing query params", () => {
    const url = connectNoticeUrl("/projects/new?step=2", "github", "taken");
    expect(url).toBe("/projects/new?step=2&integration=github&result=taken");
    expect(readConnectNotice(Object.fromEntries(new URLSearchParams(url.split("?")[1])))).toEqual({
      providerId: "github",
      result: "taken",
    });
  });

  it("ignores unknown results", () => expect(readConnectNotice({ integration: "github", result: "pwned" })).toBeNull());

  it("builds connect links", () => {
    expect(connectHref("jira")).toBe("/api/integrations/jira/connect");
    expect(connectHref("github", { add: true, returnTo: "/projects/new" })).toBe(
      "/api/integrations/github/connect?add=&returnTo=%2Fprojects%2Fnew",
    );
  });
});
