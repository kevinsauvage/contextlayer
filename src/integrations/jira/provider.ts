import "server-only";
import { ReconnectRequiredError, type ConnectionContext, type TrackerProvider } from "@/core/integrations/provider";
import { JiraApiError, JiraClient, getJiraProject, listJiraProjects } from "./client";
import { exchangeJiraCode, isJiraConfigured, jiraAuthorizeUrl, listJiraSites, refreshJiraTokens } from "./oauth";

const siteOf = (metadata: Record<string, string>, cloudId: string) => ({ cloudId, siteUrl: metadata.siteUrl ?? "" });

// A token Jira rejects needs a new consent: record it so the connection shows as needing reconnection.
async function withJiraAuth<T>(ctx: ConnectionContext, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!(error instanceof JiraApiError) || error.status !== 401) throw error;
    await ctx.markReconnect?.();
    throw new ReconnectRequiredError(ctx.label);
  }
}

// Accepts "shop-12", "SHOP-12" or a pasted issue URL ending in /browse/SHOP-12.
export function parseJiraIssueKey(projectKey: string, input: string): string | null {
  const candidate = (input.trim().split(/[?#]/)[0] ?? "").split("/").filter(Boolean).at(-1)?.toUpperCase() ?? "";
  const escaped = projectKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}-\\d+$`).test(candidate) ? candidate : null;
}

export const jiraProvider: TrackerProvider = {
  id: "jira",
  name: "Jira Cloud",
  kind: "tracker",
  description: "Reads related issues, and creates or updates issues only after you approve.",
  accountNoun: "site",
  resourceNoun: "project",
  canAddAccount: false,
  exclusive: false,

  isConfigured: isJiraConfigured,

  authorizeUrl: ({ state, redirectUri }) => jiraAuthorizeUrl(state, redirectUri),

  async complete({ query, redirectUri }) {
    const code = query.get("code");
    if (!code) return { status: "cancelled" };
    const tokens = await exchangeJiraCode(code, redirectUri);
    const sites = await listJiraSites(tokens.accessToken);
    return {
      status: "connected",
      accounts: sites.map((site) => ({
        externalId: site.id,
        label: site.name,
        metadata: { siteUrl: site.url },
        tokens,
      })),
    };
  },

  refresh: refreshJiraTokens,

  async listResources(ctx) {
    return withJiraAuth(ctx, async () => {
      const projects = await listJiraProjects(siteOf(ctx.metadata, ctx.externalId), await ctx.accessToken());
      return projects.map((project) => ({ id: project.key, label: `${project.key} · ${project.name}` }));
    });
  },

  async getResource(ctx, projectKey) {
    return withJiraAuth(ctx, async () => {
      const project = await getJiraProject(siteOf(ctx.metadata, ctx.externalId), await ctx.accessToken(), projectKey);
      return project ? { id: project.key, label: `${project.key} · ${project.name}` } : null;
    });
  },

  openTracker: (ctx, resourceId) =>
    new JiraClient(siteOf(ctx.metadata, ctx.externalId), resourceId, {
      accessToken: ctx.accessToken,
      onUnauthorized: async () => {
        await ctx.markReconnect?.();
        throw new ReconnectRequiredError(ctx.label);
      },
    }),

  parseIssueKey: parseJiraIssueKey,
  issueKeyExample: (projectKey) => `${projectKey}-123`,
};
