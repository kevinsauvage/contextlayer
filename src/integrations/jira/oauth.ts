import "server-only";
import { z } from "zod";
import { requireEnv } from "@/infrastructure/env";

const SCOPES = ["read:jira-work", "write:jira-work", "offline_access"];

const tokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
});
export type JiraTokens = { accessToken: string; refreshToken: string; expiresAt: Date };

const resourcesSchema = z.array(z.object({ id: z.string(), url: z.string(), name: z.string() }));
export type JiraSite = z.infer<typeof resourcesSchema>[number];

export const jiraRedirectUri = (baseUrl: string) => `${baseUrl}/api/jira/callback`;

export function jiraAuthorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    audience: "api.atlassian.com",
    client_id: requireEnv("JIRA_CLIENT_ID").JIRA_CLIENT_ID,
    scope: SCOPES.join(" "),
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    prompt: "consent",
  });
  return `https://auth.atlassian.com/authorize?${params}`;
}

async function requestTokens(body: Record<string, string>): Promise<JiraTokens> {
  const { JIRA_CLIENT_ID, JIRA_CLIENT_SECRET } = requireEnv("JIRA_CLIENT_ID", "JIRA_CLIENT_SECRET");
  const response = await fetch("https://auth.atlassian.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: JIRA_CLIENT_ID, client_secret: JIRA_CLIENT_SECRET, ...body }),
  });
  if (!response.ok) throw new Error(`Atlassian token request failed (${response.status})`);
  const tokens = tokenSchema.parse(await response.json());
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
  };
}

export const exchangeJiraCode = (code: string, redirectUri: string) =>
  requestTokens({ grant_type: "authorization_code", code, redirect_uri: redirectUri });

export const refreshJiraTokens = (refreshToken: string) =>
  requestTokens({ grant_type: "refresh_token", refresh_token: refreshToken });

export async function listJiraSites(accessToken: string): Promise<JiraSite[]> {
  const response = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Could not list Jira sites (${response.status})`);
  return resourcesSchema.parse(await response.json());
}
