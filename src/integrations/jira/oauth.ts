import "server-only";
import ky, { HTTPError, isKyError } from "ky";
import { z } from "zod";
import { InvalidGrantError } from "@/core/errors";
import type { OAuthTokens } from "@/core/integrations/provider";
import { hasEnv, requireEnv } from "@/infrastructure/env";

const SCOPES = ["read:jira-work", "write:jira-work", "offline_access"];
// A token refresh runs while the grant's rows are locked, so a hung Atlassian request must not hold them for long.
const REQUEST_TIMEOUT_MS = 15_000;
// A refresh token is single use: a retried request could spend it twice.
const noRetry = { timeout: REQUEST_TIMEOUT_MS, retry: 0 } as const;

const tokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
});

const resourcesSchema = z.array(z.object({ id: z.string(), url: z.string(), name: z.string() }));
type JiraSite = z.infer<typeof resourcesSchema>[number];

export const isJiraConfigured = () => hasEnv("JIRA_CLIENT_ID", "JIRA_CLIENT_SECRET");

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

// ky's timeout and network errors carry the Request, whose headers or body hold a token or the client secret.
const withoutRequest = (error: unknown) =>
  isKyError(error) ? new Error(`Atlassian request failed: ${error.name}: ${error.message}`) : error;

async function requestTokens(body: Record<string, string>): Promise<OAuthTokens> {
  const { JIRA_CLIENT_ID, JIRA_CLIENT_SECRET } = requireEnv("JIRA_CLIENT_ID", "JIRA_CLIENT_SECRET");
  try {
    const tokens = tokenSchema.parse(
      await ky
        .post("https://auth.atlassian.com/oauth/token", {
          ...noRetry,
          json: { client_id: JIRA_CLIENT_ID, client_secret: JIRA_CLIENT_SECRET, ...body },
        })
        .json(),
    );
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    };
  } catch (error) {
    if (!(error instanceof HTTPError)) throw withoutRequest(error);
    if ([400, 401, 403].includes(error.response.status))
      throw new InvalidGrantError(`Atlassian rejected the token request (${error.response.status})`);
    throw new Error(`Atlassian token request failed (${error.response.status})`);
  }
}

export const exchangeJiraCode = (code: string, redirectUri: string) =>
  requestTokens({ grant_type: "authorization_code", code, redirect_uri: redirectUri });

export const refreshJiraTokens = (refreshToken: string) =>
  requestTokens({ grant_type: "refresh_token", refresh_token: refreshToken });

export async function listJiraSites(accessToken: string): Promise<JiraSite[]> {
  try {
    return resourcesSchema.parse(
      await ky
        .get("https://api.atlassian.com/oauth/token/accessible-resources", {
          ...noRetry,
          headers: { authorization: `Bearer ${accessToken}` },
        })
        .json(),
    );
  } catch (error) {
    if (error instanceof HTTPError) throw new Error(`Could not list Jira sites (${error.response.status})`);
    throw withoutRequest(error);
  }
}
