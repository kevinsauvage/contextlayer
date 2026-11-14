import { z } from "zod";

const connectResults = [
  "connected",
  "taken",
  "no_account",
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

type Notice = { title: string; detail: string };

// OAuth reuses whichever provider account the browser is signed in to, without asking. A person who expected another
// account sees only the wrong result, so every notice that can come from that says how to switch.
const switchAccount = (name: string) =>
  `If you meant a different ${name} account, switch to it on ${name} in this browser, then connect again.`;

const NOTICES: Record<ConnectResult, (name: string) => Notice> = {
  connected: (name) => ({
    title: `${name} connected`,
    detail: `Not the account you expected? Disconnect it in Integrations, switch account on ${name}, then connect again.`,
  }),
  taken: (name) => ({
    title: `That ${name} account is already connected to another organization`,
    detail: `Disconnect it there first. ${switchAccount(name)}`,
  }),
  no_account: (name) => ({
    title: `${name} returned nothing to connect`,
    detail: `The ${name} account you are signed in to has access to nothing ContextLayer can use. ${switchAccount(name)}`,
  }),
  forbidden: (name) => ({
    title: `Your ${name} account cannot use that installation`,
    detail: `You are signed in to ${name} with an account that has no access to it. Switch to one that does on ${name}, then connect again.`,
  }),
  cancelled: (name) => ({
    title: `${name} connection cancelled`,
    detail: "Nothing was changed. Connect again when you are ready.",
  }),
  invalid: (name) => ({
    title: `The ${name} connection request expired`,
    detail: "It took too long or was started in another session. Start it again from this page.",
  }),
  unconfigured: (name) => ({
    title: `${name} is not set up on this server`,
    detail: `The server is missing its ${name} credentials. See docs/engineering/integrations-setup.md.`,
  }),
  not_admin: (name) => ({
    title: `You cannot connect ${name}`,
    detail: "Only organization owners and admins manage integrations. Ask one of them to connect it.",
  }),
  failed: (name) => ({
    title: `${name} did not respond as expected`,
    detail: "Nothing was changed. Try again in a moment.",
  }),
};

export const connectNotice = (result: ConnectResult, providerName: string) => NOTICES[result](providerName);

export const connectHref = (providerId: string, options: { add?: boolean; returnTo?: string } = {}) => {
  const params = new URLSearchParams();
  if (options.add) params.set("add", "");
  if (options.returnTo) params.set("returnTo", options.returnTo);
  const query = params.toString();
  return `/api/integrations/${providerId}/connect${query ? `?${query}` : ""}`;
};
