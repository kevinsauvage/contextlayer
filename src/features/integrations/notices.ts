import { z } from "zod";

const connectResults = [
  "connected",
  "taken",
  "forbidden",
  "cancelled",
  "invalid",
  "unconfigured",
  "not_admin",
  "failed",
] as const;
export type ConnectResult = (typeof connectResults)[number];

export function connectNoticeUrl(returnTo: string, providerId: string, result: ConnectResult): string {
  const url = new URL(returnTo, "http://placeholder");
  url.searchParams.set("integration", providerId);
  url.searchParams.set("result", result);
  return `${url.pathname}${url.search}`;
}

const noticeSchema = z.object({ integration: z.string(), result: z.enum(connectResults) });

export function readConnectNotice(params: Record<string, string | string[] | undefined>) {
  const parsed = noticeSchema.safeParse(params);
  return parsed.success ? { providerId: parsed.data.integration, result: parsed.data.result } : null;
}

const MESSAGES: Record<ConnectResult, (name: string) => string> = {
  connected: (name) => `${name} connected.`,
  taken: (name) => `That ${name} account is already connected to another organization. Disconnect it there first.`,
  forbidden: (name) => `Your ${name} user does not have access to that installation.`,
  cancelled: (name) => `${name} connection was cancelled.`,
  invalid: (name) => `The ${name} connection request expired or was invalid. Try again.`,
  unconfigured: (name) => `${name} is not configured on this server. See docs/engineering/integrations-setup.md.`,
  not_admin: (name) => `Only organization owners and admins can connect ${name}.`,
  failed: (name) => `${name} did not respond as expected. Try again in a moment.`,
};

export const connectNoticeMessage = (result: ConnectResult, providerName: string) => MESSAGES[result](providerName);

export const connectHref = (providerId: string, options: { add?: boolean; returnTo?: string } = {}) => {
  const params = new URLSearchParams();
  if (options.add) params.set("add", "");
  if (options.returnTo) params.set("returnTo", options.returnTo);
  const query = params.toString();
  return `/api/integrations/${providerId}/connect${query ? `?${query}` : ""}`;
};
