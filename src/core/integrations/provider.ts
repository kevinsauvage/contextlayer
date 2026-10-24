import type { ContextSource, IssueTracker } from "@/core/context/source";

export type ProviderKind = "source" | "tracker";

// The fields every provider exposes to the UI; the descriptor is picked from them so adding a field is one edit.
const PROVIDER_DESCRIPTOR_KEYS = [
  "id",
  "name",
  "kind",
  "description",
  "accountNoun",
  "resourceNoun",
  "canAddAccount",
  "exclusive",
] as const;

export type Resource = { id: string; label: string };

export type OAuthTokens = { accessToken: string; refreshToken: string; expiresAt: Date };

export type ConnectedAccount = {
  externalId: string;
  label: string;
  metadata: Record<string, string>;
  tokens: OAuthTokens | null;
};

export type CompleteResult =
  | { status: "connected"; accounts: ConnectedAccount[] }
  | { status: "redirect"; url: string }
  | { status: "forbidden" }
  | { status: "cancelled" };

export type ConnectionContext = {
  externalId: string;
  label: string;
  metadata: Record<string, string>;
  accessToken: () => Promise<string>;
  // Called when the provider rejects a token it just handed out: records that a new consent is needed.
  markReconnect?: () => Promise<void>;
};

type BaseProvider = {
  id: string;
  name: string;
  kind: ProviderKind;
  description: string;
  accountNoun: string;
  resourceNoun: string;
  // GitHub-style apps are installed per account, so "add another account" is a separate step from sign-in.
  canAddAccount: boolean;
  // An exclusive account (a GitHub App installation) may belong to one organization only.
  exclusive: boolean;
  isConfigured(): boolean;
  authorizeUrl(input: { state: string; redirectUri: string; add: boolean }): string;
  complete(input: { query: URLSearchParams; state: string; redirectUri: string }): Promise<CompleteResult>;
  refresh?: (refreshToken: string) => Promise<OAuthTokens>;
  listResources(ctx: ConnectionContext): Promise<Resource[]>;
  // Optional single lookup; callers fall back to listing when a provider does not implement it.
  getResource?(ctx: ConnectionContext, id: string): Promise<Resource | null>;
};

export type SourceProvider = BaseProvider & {
  kind: "source";
  openSource(ctx: ConnectionContext, resourceId: string): Promise<ContextSource>;
};

export type TrackerProvider = BaseProvider & {
  kind: "tracker";
  openTracker(ctx: ConnectionContext, resourceId: string): IssueTracker;
  // Normalizes user input to an issue key in this resource, or null when it is not one.
  parseIssueKey(resourceId: string, input: string): string | null;
  issueKeyExample(resourceId: string): string;
};

export type IntegrationProvider = SourceProvider | TrackerProvider;

export type ProviderDescriptor = Pick<IntegrationProvider, (typeof PROVIDER_DESCRIPTOR_KEYS)[number]>;

// The provider revoked or expired the grant: only a new consent can fix it.
export class InvalidGrantError extends Error {}

export class ReconnectRequiredError extends Error {
  constructor(readonly connectionLabel: string) {
    super(`The connection to ${connectionLabel} expired.`);
  }
}

export function describeProvider(provider: IntegrationProvider): ProviderDescriptor {
  return Object.fromEntries(PROVIDER_DESCRIPTOR_KEYS.map((key) => [key, provider[key]])) as ProviderDescriptor;
}
