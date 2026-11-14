import { inspect } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReconnectRequiredError, TrackerNotFoundError, TrackerRejectedError } from "@/core/errors";
import { JiraClient, getJiraProject, listJiraProjects } from "@/integrations/jira/client";

const site = { cloudId: "cloud-1", siteUrl: "https://shop.atlassian.net" };
const auth = (accessToken = "at-1") => ({ accessToken: async () => accessToken });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// ky hands fetch a Request; the tests read the same url, method and body they always did.
const stubFetch = (handler: (url: string, init: RequestInit) => Response | Promise<Response>) =>
  vi.stubGlobal("fetch", async (request: Request) =>
    handler(request.url, {
      method: request.method,
      headers: request.headers,
      body: (await request.text()) || undefined,
    }),
  );

afterEach(() => vi.unstubAllGlobals());

describe("JiraClient", () => {
  it("retries a read once Jira answers 429", async () => {
    let calls = 0;
    stubFetch(() => {
      calls += 1;
      return calls === 1
        ? new Response("slow down", { status: 429, headers: { "retry-after": "0" } })
        : json({ issues: [] });
    });

    await new JiraClient(site, "SHOP", auth()).searchRelated(["cart"], 5);

    expect(calls).toBe(2);
  });

  it("builds one escaped JQL term per search term", async () => {
    const bodies: unknown[] = [];
    stubFetch(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse((init.body ?? "{}") as string));
      return json({ issues: [] });
    });

    await new JiraClient(site, "SHOP", auth()).searchRelated(['cart "total"'], 5);

    expect(bodies).toEqual([
      {
        jql: 'project = "SHOP" AND (text ~ "cart \\"total\\"") ORDER BY updated DESC',
        fields: ["summary", "description", "status", "updated"],
        maxResults: 20,
      },
    ]);
  });

  it("searches with the five strongest terms and keeps the issues that match the most", async () => {
    const issue = (key: string, summary: string) => ({ key, fields: { summary, status: { name: "Done" } } });
    let jql = "";
    stubFetch((_url, init) => {
      jql = (JSON.parse(init.body as string) as { jql: string }).jql;
      return json({ issues: [issue("SHOP-1", "Unrelated"), issue("SHOP-2", "Cart total rounding")] });
    });

    const found = await new JiraClient(site, "SHOP", auth()).searchRelated(
      ["cart", "total", "a1", "b2", "c3", "ignored"],
      1,
    );

    expect(jql).not.toContain("ignored");
    expect(found.map((item) => item.key)).toEqual(["SHOP-2"]);
  });

  it("ranks an accented summary by its folded terms", async () => {
    const issue = (key: string, summary: string) => ({ key, fields: { summary, status: { name: "Done" } } });
    // Without folding both score one summary hit, and the first one Jira returned would win.
    stubFetch(() => json({ issues: [issue("SHOP-1", "Export is slow"), issue("SHOP-2", "Créer l'export")] }));

    const found = await new JiraClient(site, "SHOP", auth()).searchRelated(["creer", "export"], 1);

    expect(found.map((item) => item.key)).toEqual(["SHOP-2"]);
  });

  it("maps an issue to text and a browse URL", async () => {
    stubFetch(async () =>
      json({
        key: "SHOP-7",
        fields: {
          summary: "Cart total",
          description: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Rounds the wrong way" }] }],
          },
          status: { name: "In Progress" },
          updated: "2026-10-25T10:00:00.000+0000",
        },
      }),
    );

    expect(await new JiraClient(site, "SHOP", auth()).getIssue("SHOP-7")).toEqual({
      key: "SHOP-7",
      summary: "Cart total",
      description: "Rounds the wrong way",
      status: "In Progress",
      url: "https://shop.atlassian.net/browse/SHOP-7",
      updated: "2026-10-25T10:00:00.000+0000",
    });
  });

  it("creates a Task in the project with an ADF description", async () => {
    const requests: { url: string; init: RequestInit }[] = [];
    stubFetch(async (url: string, init: RequestInit) => {
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

  it("refuses a description longer than Jira accepts without sending the write", async () => {
    const methods: (string | undefined)[] = [];
    stubFetch(async (_url: string, init: RequestInit) => {
      methods.push(init.method);
      return json({ issueTypes: [{ name: "Task", subtask: false }] });
    });
    const long = { text: "x".repeat(4000), status: "inferred" as const, evidenceIds: [] };

    await expect(
      new JiraClient(site, "SHOP", auth()).createIssue({
        title: "Too long",
        description: Array.from({ length: 9 }, () => long),
        acceptanceCriteria: [],
        assumptions: [],
        openQuestions: [],
        evidence: [],
      }),
    ).rejects.toThrow("The ticket is longer than Jira allows (32,767 characters)");
    expect(methods).not.toContain("POST");
  });

  it("marks the connection when a fresh token is rejected", async () => {
    const onUnauthorized = vi.fn(async () => {
      throw new ReconnectRequiredError("Jira site");
    });
    stubFetch(async () => new Response("token revoked", { status: 401 }));

    const tracker = new JiraClient(site, "SHOP", { accessToken: async () => "at-1", onUnauthorized });

    await expect(tracker.getIssue("SHOP-7")).rejects.toBeInstanceOf(ReconnectRequiredError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("surfaces a 401 when the caller cannot mark the connection", async () => {
    stubFetch(async () => new Response("token revoked", { status: 401 }));

    await expect(new JiraClient(site, "SHOP", auth()).getIssue("SHOP-7")).rejects.toThrow("Jira API error 401");
  });

  it("maps a 400 on a write to the field message Jira returned", async () => {
    stubFetch(async (_url: string, init: RequestInit) =>
      init.method === "POST"
        ? json({ errorMessages: [], errors: { summary: "The summary is too long." } }, 400)
        : json({ issueTypes: [{ name: "Task", subtask: false }] }),
    );

    const draft = {
      title: "Round cart totals",
      description: [{ text: "Round half up", status: "verified" as const, evidenceIds: [] }],
      acceptanceCriteria: [],
      assumptions: [],
      openQuestions: [],
      evidence: [],
    };
    const tracker = new JiraClient(site, "SHOP", auth());

    await expect(tracker.createIssue(draft)).rejects.toBeInstanceOf(TrackerRejectedError);
    await expect(tracker.createIssue(draft)).rejects.toThrow("summary: The summary is too long.");
  });

  it("never resends a write after a dropped connection, which may hide an issue Jira created", async () => {
    let posts = 0;
    stubFetch(async (_url: string, init: RequestInit) => {
      if (init.method !== "POST") return json({ issueTypes: [{ name: "Task", subtask: false }] });
      posts += 1;
      throw new TypeError("fetch failed");
    });
    const draft = {
      title: "Round cart totals",
      description: [{ text: "Round half up", status: "verified" as const, evidenceIds: [] }],
      acceptanceCriteria: [],
      assumptions: [],
      openQuestions: [],
      evidence: [],
    };

    await expect(new JiraClient(site, "SHOP", auth()).createIssue(draft)).rejects.toThrow("network error");
    expect(posts).toBe(1);
  });

  it("never leaks the bearer token when a request times out or the network fails", async () => {
    stubFetch(async () => {
      throw new TypeError("fetch failed");
    });

    const error = await new JiraClient(site, "SHOP", auth("secret-token")).getIssue("SHOP-7").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as { request?: unknown }).request).toBeUndefined();
    expect(inspect(error)).not.toContain("secret-token");
    expect((error as Error).message).toContain("network error");
  });

  it("says an issue is missing or hidden instead of failing the analysis", async () => {
    stubFetch(async () => new Response("", { status: 404 }));

    await expect(new JiraClient(site, "SHOP", auth()).getIssue("SHOP-99999")).rejects.toThrow(
      new TrackerNotFoundError("Jira has no issue SHOP-99999, or the connected account cannot see it."),
    );
  });

  it("reports a project the account cannot see as a refusal, not a crash", async () => {
    stubFetch(async () => new Response("", { status: 404 }));
    const draft = {
      title: "Round cart totals",
      description: [{ text: "Round half up", status: "verified" as const, evidenceIds: [] }],
      acceptanceCriteria: [],
      assumptions: [],
      openQuestions: [],
      evidence: [],
    };

    await expect(new JiraClient(site, "SHOP", auth()).createIssue(draft)).rejects.toThrow(
      new TrackerRejectedError("Jira could not find the SHOP project, or the connected account cannot see it."),
    );
  });

  it("refuses a write rather than waiting out a long rate limit", async () => {
    let puts = 0;
    stubFetch(async (_url, init) => {
      if (init.method !== "PUT") return json({});
      puts += 1;
      return new Response("slow down", { status: 429, headers: { "retry-after": "90" } });
    });
    const draft = {
      title: "Round cart totals",
      description: [{ text: "Round half up", status: "verified" as const, evidenceIds: [] }],
      acceptanceCriteria: [],
      assumptions: [],
      openQuestions: [],
      evidence: [],
    };

    await expect(new JiraClient(site, "SHOP", auth()).updateIssue("SHOP-7", draft)).rejects.toThrow(
      "Jira is rate limiting this connection; try again in 90 s.",
    );
    expect(puts).toBe(1);
  });

  it("retries a write once Jira answers 429", async () => {
    let puts = 0;
    stubFetch(async (_url: string, init: RequestInit) => {
      if (init.method !== "PUT") return json({});
      puts += 1;
      return puts === 1
        ? new Response("slow down", { status: 429, headers: { "retry-after": "0" } })
        : new Response(null, { status: 204 });
    });
    const draft = {
      title: "Round cart totals",
      description: [{ text: "Round half up", status: "verified" as const, evidenceIds: [] }],
      acceptanceCriteria: [],
      assumptions: [],
      openQuestions: [],
      evidence: [],
    };

    await new JiraClient(site, "SHOP", auth()).updateIssue("SHOP-7", draft);

    expect(puts).toBe(2);
  });

  it("retries a read after a dropped connection", async () => {
    let calls = 0;
    stubFetch(() => {
      calls += 1;
      if (calls === 1) throw new TypeError("fetch failed");
      return json({ issues: [] });
    });

    await new JiraClient(site, "SHOP", auth()).searchRelated(["cart"], 5);

    expect(calls).toBe(2);
  });

  it("reads a 403 or a 404 on a write as a refusal the person can act on", async () => {
    const draft = {
      title: "Round cart totals",
      description: [{ text: "Round half up", status: "verified" as const, evidenceIds: [] }],
      acceptanceCriteria: [],
      assumptions: [],
      openQuestions: [],
      evidence: [],
    };
    const tracker = new JiraClient(site, "SHOP", auth());

    stubFetch(async () => new Response("", { status: 403 }));
    await expect(tracker.updateIssue("SHOP-7", draft)).rejects.toThrow(
      new TrackerRejectedError("Jira refused: the connected account cannot create or edit issues in SHOP."),
    );

    stubFetch(async () =>
      json({ errorMessages: ["Issue does not exist or you do not have permission to see it."] }, 404),
    );
    await expect(tracker.updateIssue("SHOP-7", draft)).rejects.toThrow(
      new TrackerRejectedError("Issue does not exist or you do not have permission to see it."),
    );
  });

  it("reads the field message from a rejection body longer than the logged excerpt", async () => {
    const errors = { summary: "The summary is too long.", description: "x".repeat(400) };
    stubFetch(async (_url: string, init: RequestInit) =>
      init.method === "PUT" ? json({ errorMessages: [], errors }, 400) : json({}),
    );
    const draft = {
      title: "Round cart totals",
      description: [{ text: "Round half up", status: "inferred" as const, evidenceIds: [] }],
      acceptanceCriteria: [],
      assumptions: [],
      openQuestions: [],
      evidence: [],
    };

    await expect(new JiraClient(site, "SHOP", auth()).updateIssue("SHOP-7", draft)).rejects.toThrow(
      "summary: The summary is too long.",
    );
  });
});

describe("listJiraProjects", () => {
  it("pages through the search until the last page", async () => {
    const starts: string[] = [];
    stubFetch(async (url: string) => {
      const startAt = new URL(url).searchParams.get("startAt") ?? "0";
      starts.push(startAt);
      return startAt === "0"
        ? json({
            values: [
              { key: "A", name: "Alpha" },
              { key: "B", name: "Beta" },
            ],
            isLast: false,
          })
        : json({ values: [{ key: "C", name: "Gamma" }], isLast: true });
    });

    expect(await listJiraProjects(site, "at-1")).toEqual([
      { key: "A", name: "Alpha" },
      { key: "B", name: "Beta" },
      { key: "C", name: "Gamma" },
    ]);
    expect(starts).toEqual(["0", "2"]);
  });

  it("stops after one page when the site omits the last-page flag", async () => {
    let calls = 0;
    stubFetch(async () => {
      calls += 1;
      return json({ values: [{ key: "A", name: "Alpha" }] });
    });

    expect(await listJiraProjects(site, "at-1")).toEqual([{ key: "A", name: "Alpha" }]);
    expect(calls).toBe(1);
  });
});

describe("getJiraProject", () => {
  it("returns null once the project is deleted", async () => {
    stubFetch(async () => new Response("not found", { status: 404 }));
    expect(await getJiraProject(site, "at-1", "GONE")).toBeNull();
  });

  it("rethrows other failures", async () => {
    stubFetch(async () => new Response("boom", { status: 500 }));
    await expect(getJiraProject(site, "at-1", "SHOP")).rejects.toThrow("Jira API error 500");
  });
});
