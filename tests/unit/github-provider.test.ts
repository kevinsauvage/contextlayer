import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  accountsForUser: vi.fn(),
  repos: [] as { owner: string; name: string }[],
  repo: null as { owner: string; name: string } | null,
  directory: true,
  connected: vi.fn(),
}));

vi.mock("@/integrations/github/app", () => ({
  isGithubConfigured: () => true,
  githubInstallUrl: (state: string) => `https://github.test/install?state=${state}`,
  githubAuthorizeUrl: (state: string, redirectUri: string) =>
    `https://github.test/authorize?state=${state}&redirect_uri=${redirectUri}`,
  githubAccountsForUser: state.accountsForUser,
  listInstallationRepos: async () => state.repos,
  getInstallationRepo: async () => state.repo,
  getInstallationDirectory: async () => state.directory,
}));

vi.mock("@/integrations/github/source", () => ({
  GithubSource: { connect: state.connected },
}));

const { githubProvider } = await import("@/integrations/github/provider");

const ctx = { externalId: "42" } as never;
const query = (values: Record<string, string>) => new URLSearchParams(values);

beforeEach(() => {
  state.repos = [];
  state.repo = null;
  state.directory = true;
  state.connected.mockReset();
  state.accountsForUser.mockReset();
});

describe("githubProvider.complete", () => {
  it("cancels when GitHub returned no code", async () => {
    await expect(
      githubProvider.complete({ query: query({}), state: "s", redirectUri: "http://localhost/cb" }),
    ).resolves.toEqual({ status: "cancelled" });
  });

  it("refuses an installation id that is not an integer", async () => {
    await expect(
      githubProvider.complete({
        query: query({ code: "c", installation_id: "4.5" }),
        state: "s",
        redirectUri: "http://localhost/cb",
      }),
    ).resolves.toEqual({ status: "forbidden" });
  });

  it("links only the installation the install page returned", async () => {
    state.accountsForUser.mockResolvedValue([
      { installationId: 1, accountLogin: "acme" },
      { installationId: 2, accountLogin: "other" },
    ]);

    await expect(
      githubProvider.complete({
        query: query({ code: "c", installation_id: "2" }),
        state: "s",
        redirectUri: "http://localhost/cb",
      }),
    ).resolves.toMatchObject({ status: "connected", accounts: [{ externalId: "2", label: "other" }] });
  });

  it("refuses an installation the user cannot access", async () => {
    state.accountsForUser.mockResolvedValue([{ installationId: 1, accountLogin: "acme" }]);

    await expect(
      githubProvider.complete({
        query: query({ code: "c", installation_id: "99" }),
        state: "s",
        redirectUri: "http://localhost/cb",
      }),
    ).resolves.toEqual({ status: "forbidden" });
  });

  it("sends a user with no installation to the install page", async () => {
    state.accountsForUser.mockResolvedValue([]);

    await expect(
      githubProvider.complete({ query: query({ code: "c" }), state: "abc", redirectUri: "http://localhost/cb" }),
    ).resolves.toEqual({ status: "redirect", url: "https://github.test/install?state=abc" });
  });
});

describe("githubProvider resources", () => {
  it("lists accessible repositories by label", async () => {
    state.repos = [
      { owner: "acme", name: "web" },
      { owner: "acme", name: "api" },
    ];

    await expect(githubProvider.listResources(ctx)).resolves.toEqual([
      { id: "acme/api", label: "acme/api" },
      { id: "acme/web", label: "acme/web" },
    ]);
  });

  it("refuses a malformed scoped id instead of reading the whole repository", async () => {
    await expect(githubProvider.getResource?.(ctx, "acme/repo#../etc")).resolves.toBeNull();
    await expect(githubProvider.getResource?.(ctx, "acme/repo#apps//web")).resolves.toBeNull();
    await expect(githubProvider.getResource?.(ctx, "no-slash")).resolves.toBeNull();
  });

  it("returns the repository, scoped to its folder", async () => {
    state.repo = { owner: "acme", name: "web" };

    await expect(githubProvider.getResource?.(ctx, "acme/web#apps/admin")).resolves.toEqual({
      id: "acme/web#apps/admin",
      label: "acme/web · apps/admin",
    });
  });

  it("returns nothing for a repository or a folder the app cannot see", async () => {
    state.repo = { owner: "acme", name: "web" };
    state.directory = false;

    await expect(githubProvider.getResource?.(ctx, "acme/web#apps/gone")).resolves.toBeNull();
    state.repo = null;
    await expect(githubProvider.getResource?.(ctx, "acme/gone")).resolves.toBeNull();
  });

  it("opens the scoped source at the project's deadline", async () => {
    const deadline = new AbortController().signal;
    state.connected.mockResolvedValue({ source: true });

    const source = await githubProvider.openSource(ctx, "acme/web#apps/web", { deadline });

    expect(source).toEqual({ source: true });
    expect(state.connected).toHaveBeenCalledWith(42, { owner: "acme", name: "web" }, "apps/web", deadline);
  });
});

describe("githubProvider authorization", () => {
  it("sends an add-account click straight to the install page", () => {
    expect(githubProvider.authorizeUrl({ state: "s", redirectUri: "r", add: true })).toBe(
      "https://github.test/install?state=s",
    );
  });

  it("signs in through OAuth for a first connection", () => {
    expect(githubProvider.authorizeUrl({ state: "s", redirectUri: "r", add: false })).toBe(
      "https://github.test/authorize?state=s&redirect_uri=r",
    );
  });
});
