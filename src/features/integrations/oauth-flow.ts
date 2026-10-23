import "server-only";
import type { IntegrationProvider } from "@/core/integrations/provider";
import type { OrgContext } from "@/infrastructure/auth/session";
import type { Database } from "@/infrastructure/db/client";
import { getEnv } from "@/infrastructure/env";
import { signState, verifyState } from "@/infrastructure/signed-state";
import { safePath } from "@/lib/safe-path";
import { saveAccounts } from "./connections";
import { connectNoticeUrl, type ConnectResult } from "./notices";

const DEFAULT_RETURN = "/settings/integrations";

const redirectUriFor = (provider: IntegrationProvider) =>
  new URL(`/api/integrations/${provider.id}/callback`, getEnv().BETTER_AUTH_URL).toString();

const noticeRedirect = (returnTo: string, provider: IntegrationProvider, result: ConnectResult) =>
  new URL(connectNoticeUrl(returnTo, provider.id, result), getEnv().BETTER_AUTH_URL).toString();

export function startConnect(
  provider: IntegrationProvider,
  context: OrgContext,
  options: { add: boolean; returnTo: string | null },
): string {
  const returnTo = safePath(options.returnTo, DEFAULT_RETURN);
  if (!context.isAdmin) return noticeRedirect(returnTo, provider, "not_admin");
  if (!provider.isConfigured()) return noticeRedirect(returnTo, provider, "unconfigured");
  const state = signState({
    userId: context.userId,
    organizationId: context.organizationId,
    provider: provider.id,
    returnTo,
  });
  return provider.authorizeUrl({ state, redirectUri: redirectUriFor(provider), add: options.add });
}

export async function finishConnect(
  db: Database,
  provider: IntegrationProvider,
  context: OrgContext,
  query: URLSearchParams,
): Promise<string> {
  const rawState = query.get("state");
  const state = verifyState(rawState);
  if (
    !rawState ||
    state?.userId !== context.userId ||
    state.organizationId !== context.organizationId ||
    state.provider !== provider.id
  ) {
    return noticeRedirect(DEFAULT_RETURN, provider, "invalid");
  }
  if (!context.isAdmin) return noticeRedirect(state.returnTo, provider, "not_admin");

  try {
    const result = await provider.complete({ query, state: rawState, redirectUri: redirectUriFor(provider) });
    if (result.status === "redirect") return result.url;
    if (result.status !== "connected") return noticeRedirect(state.returnTo, provider, result.status);
    const outcome = await saveAccounts(db, {
      organizationId: context.organizationId,
      userId: context.userId,
      provider,
      accounts: result.accounts,
    });
    return noticeRedirect(state.returnTo, provider, outcome);
  } catch (error) {
    console.error(`[integrations] ${provider.id} callback failed`, error);
    return noticeRedirect(state.returnTo, provider, "failed");
  }
}
