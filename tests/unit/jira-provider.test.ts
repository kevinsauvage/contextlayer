import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  sites: [] as { id: string; url: string; name: string }[],
  projects: [] as { key: string; name: string }[],
  project: null as { key: string; name: string } | null,
  exchange: vi.fn(),
  refresh: vi.fn(),
  failWith: undefined as number | undefined,
}));

vi.mock("@/integrations/jira/oauth", () => ({
  isJiraConfigured: () => true,
  jiraAuthorizeUrl: (state: string, redirectUri: string) =>
    `https://jira.test/authorize?state=${state}&redirect_uri=${redirectUri}`,
  exchangeJiraCode: state.exchange,
  listJiraSites: async () => state.sites,
  refreshJiraTokens: state.refresh,
}));

vi.mock("@/integrations/jira/client", () => {
  class JiraApiError extends Error {
    constructor(readonly status: number) {
      super(`Jira API error ${status}`);
    }
  }
  class JiraClient {
    constructor(
      readonly site: unknown,
      readonly projectKey: string,
      readonly handlers: { accessToken: () => Promise<string>; onUnauthorized: () => Promise<never> },
    ) {}
  }
  const maybeFail = async <T>(value: T): Promise<T> => {
    if (state.failWith !== undefined) throw new JiraApiError(state.failWith);
    return value;
  };
  return {
    JiraApiError,
    JiraClient,
    listJiraProjects: async () => maybeFail(state.projects),
    getJiraProject: async () => maybeFail(state.project),
  };
});

const { ctx, markReconnect, token } = vi.hoisted(() => {
  const token = vi.fn(async () => "access-token");
  const markReconnect = vi.fn(async () => undefined);
  return {
    token,
    markReconnect,
    ctx: { externalId: "cloud-1", label: "Acme Jira", metadata: { siteUrl: "https://acme.atlassian.net" } },
  };
});

const { jiraProvider } = await import("@/integrations/jira/provider");
const { JiraApiError } = await import("@/integrations/jira/client");
const { ReconnectRequiredError } = await import("@/core/errors");

type TrackerClient = {
  site: unknown;
  projectKey: string;
  handlers: { accessToken: () => Promise<string>; onUnauthorized: () => Promise<never> };
};

const context = () => ({ ...ctx, accessToken: token, markReconnect }) as never;

beforeEach(() => {
  state.sites = [];
  state.projects = [];
  state.project = null;
  state.failWith = undefined;
  state.exchange.mockReset();
  state.refresh.mockReset();
  token.mockClear();
  markReconnect.mockClear();
});

describe("jiraProvider.complete", () => {
  it("cancels when Atlassian returned no code", async () => {
    await expect(
      jiraProvider.complete({ query: new URLSearchParams(), state: "s", redirectUri: "r" }),
    ).resolves.toEqual({ status: "cancelled" });
  });

  it("connects every accessible Jira site with the shared tokens", async () => {
    const tokens = { accessToken: "a", refreshToken: "r", expiresAt: new Date() };
    state.exchange.mockResolvedValue(tokens);
    state.sites = [{ id: "cloud-1", url: "https://acme.atlassian.net", name: "Acme" }];

    await expect(
      jiraProvider.complete({ query: new URLSearchParams({ code: "c" }), state: "s", redirectUri: "http://cb" }),
    ).resolves.toEqual({
      status: "connected",
      accounts: [
        {
          externalId: "cloud-1",
          label: "Acme",
          metadata: { siteUrl: "https://acme.atlassian.net" },
          tokens,
        },
      ],
    });
    expect(state.exchange).toHaveBeenCalledWith("c", "http://cb");
  });
});

describe("jiraProvider resources", () => {
  it("lists projects as key and name", async () => {
    state.projects = [{ key: "SHOP", name: "Shop" }];
    await expect(jiraProvider.listResources(context())).resolves.toEqual([{ id: "SHOP", label: "SHOP · Shop" }]);
    expect(token).toHaveBeenCalled();
  });

  it("returns one project or null", async () => {
    state.project = { key: "SHOP", name: "Shop" };
    await expect(jiraProvider.getResource?.(context(), "SHOP")).resolves.toEqual({ id: "SHOP", label: "SHOP · Shop" });
    state.project = null;
    await expect(jiraProvider.getResource?.(context(), "GONE")).resolves.toBeNull();
  });

  it("marks the connection for reconnection when Jira rejects the token", async () => {
    state.failWith = 401;

    await expect(jiraProvider.listResources(context())).rejects.toThrow(ReconnectRequiredError);
    expect(markReconnect).toHaveBeenCalledOnce();
  });

  it("lets a non-authentication failure surface unchanged", async () => {
    state.failWith = 500;

    await expect(jiraProvider.listResources(context())).rejects.toBeInstanceOf(JiraApiError);
    expect(markReconnect).not.toHaveBeenCalled();
  });
});

describe("jiraProvider.openTracker", () => {
  it("passes the site, the project and a lazy token to the client", async () => {
    const client = jiraProvider.openTracker(context(), "SHOP") as unknown as TrackerClient;

    expect(client.projectKey).toBe("SHOP");
    expect(client.site).toEqual({ cloudId: "cloud-1", siteUrl: "https://acme.atlassian.net" });
    await expect(client.handlers.accessToken()).resolves.toBe("access-token");
  });

  it("reconnects when the client reports an unauthorized write", async () => {
    const client = jiraProvider.openTracker(context(), "SHOP") as unknown as TrackerClient;

    await expect(client.handlers.onUnauthorized()).rejects.toThrow(ReconnectRequiredError);
    expect(markReconnect).toHaveBeenCalledOnce();
  });
});

describe("jiraProvider wiring", () => {
  it("builds the Atlassian authorize URL and exposes the token refresh", () => {
    expect(jiraProvider.authorizeUrl({ state: "s", redirectUri: "r", add: false })).toBe(
      "https://jira.test/authorize?state=s&redirect_uri=r",
    );
    expect(jiraProvider.refresh).toBe(state.refresh);
  });
});
