import { afterEach, describe, expect, it, vi } from "vitest";
import { ReconnectRequiredError } from "@/core/integrations/provider";
import { JiraClient, getJiraProject } from "@/integrations/jira/client";

const site = { cloudId: "cloud-1", siteUrl: "https://shop.atlassian.net" };
const auth = (accessToken = "at-1") => ({ accessToken: async () => accessToken });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("JiraClient", () => {
  it("builds one escaped JQL term per search term", async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse((init.body ?? "{}") as string));
      return json({ issues: [] });
    });

    await new JiraClient(site, "SHOP", auth()).searchRelated(['cart "total"'], 5);

    expect(bodies).toEqual([
      {
        jql: 'project = "SHOP" AND (text ~ "cart \\"total\\"") ORDER BY updated DESC',
        fields: ["summary", "description", "status"],
        maxResults: 5,
      },
    ]);
  });

  it("maps an issue to text and a browse URL", async () => {
    vi.stubGlobal("fetch", async () =>
      json({
        key: "SHOP-7",
        fields: {
          summary: "Cart total",
          description: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Rounds the wrong way" }] }],
          },
          status: { name: "In Progress" },
        },
      }),
    );

    expect(await new JiraClient(site, "SHOP", auth()).getIssue("SHOP-7")).toEqual({
      key: "SHOP-7",
      summary: "Cart total",
      description: "Rounds the wrong way",
      status: "In Progress",
      url: "https://shop.atlassian.net/browse/SHOP-7",
    });
  });

  it("creates a Task in the project with an ADF description", async () => {
    const requests: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      return init.method === "POST"
        ? json({ key: "SHOP-9" }, 201)
        : json({
            issueTypes: [
              { name: "Sub-task", subtask: true },
              { name: "Bug", subtask: false },
              { name: "Task", subtask: false },
            ],
          });
    });

    const published = await new JiraClient(site, "SHOP", auth()).createIssue({
      title: "Round cart totals",
      description: [{ text: "Round half up", status: "verified", evidenceIds: [] }],
      acceptanceCriteria: [
        { text: "Total is rounded", status: "verified", evidenceIds: [], requiresProductDecision: false },
      ],
      assumptions: [],
      openQuestions: [],
      evidence: [],
    });

    expect(published).toEqual({ key: "SHOP-9", url: "https://shop.atlassian.net/browse/SHOP-9" });
    const post = requests.find((request) => request.init.method === "POST");
    const body = JSON.parse((post?.init.body ?? "{}") as string) as {
      fields: { issuetype: { name: string }; project: { key: string } };
    };
    expect(body.fields.issuetype.name).toBe("Task");
    expect(body.fields.project.key).toBe("SHOP");
  });

  it("marks the connection when a fresh token is rejected", async () => {
    const onUnauthorized = vi.fn(async () => {
      throw new ReconnectRequiredError("Jira site");
    });
    vi.stubGlobal("fetch", async () => new Response("token revoked", { status: 401 }));

    const tracker = new JiraClient(site, "SHOP", { accessToken: async () => "at-1", onUnauthorized });

    await expect(tracker.getIssue("SHOP-7")).rejects.toBeInstanceOf(ReconnectRequiredError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("surfaces a 401 when the caller cannot mark the connection", async () => {
    vi.stubGlobal("fetch", async () => new Response("token revoked", { status: 401 }));

    await expect(new JiraClient(site, "SHOP", auth()).getIssue("SHOP-7")).rejects.toThrow("Jira API error 401");
  });
});

describe("getJiraProject", () => {
  it("returns null once the project is deleted", async () => {
    vi.stubGlobal("fetch", async () => new Response("not found", { status: 404 }));
    expect(await getJiraProject(site, "at-1", "GONE")).toBeNull();
  });

  it("rethrows other failures", async () => {
    vi.stubGlobal("fetch", async () => new Response("boom", { status: 500 }));
    await expect(getJiraProject(site, "at-1", "SHOP")).rejects.toThrow("Jira API error 500");
  });
});
