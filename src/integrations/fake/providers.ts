import "server-only";
import type { ContextSource, Issue, IssueTracker, PublishedIssue, SearchResult } from "@/core/context/source";
import type { SourceProvider, TrackerProvider } from "@/core/integrations/provider";
import type { TicketDraft } from "@/core/requirements/schemas";

// Test-only providers, enabled by E2E_FAKE_PROVIDERS (see `env.ts`): a fixed repository and a tracker kept in memory,
// so a browser test can connect, draft and publish without GitHub, Jira or their credentials.

const REPOSITORY = "sample/shop";
const PROJECT_KEY = "SHOP";

const FILES: Record<string, string> = {
  "src/components/Banner.tsx": `export function Banner() {\n  return <h1 id="hero-title">Welcome to the shop</h1>;\n}\n`,
  "src/cart/total.ts": `export const cartTotal = (prices: number[]) => Math.floor(prices.reduce((a, b) => a + b, 0));\n`,
  "README.md": "# Sample shop\n\nA storefront used by the end-to-end test.\n",
};

const sampleSource: ContextSource = {
  revision: "0000000000000000000000000000000000000000",
  listFiles: () => Promise.resolve(Object.keys(FILES)),
  readFile: (path) => {
    const content = FILES[path];
    return content === undefined ? Promise.reject(new Error(`No such file: ${path}`)) : Promise.resolve(content);
  },
  searchContent: (terms): Promise<SearchResult> =>
    Promise.resolve({
      paths: Object.keys(FILES).filter((path) => terms.some((term) => FILES[path]?.toLowerCase().includes(term))),
      failedTerms: [],
    }),
};

// One store per server process, kept on globalThis so a module reload does not lose the issues a test created.
const store = globalThis as unknown as { fakeTrackerIssues?: Issue[] };
const issues = () => (store.fakeTrackerIssues ??= []);

const published = (key: string): PublishedIssue => ({ key, url: `https://tracker.invalid/browse/${key}` });

const issueFrom = (key: string, draft: TicketDraft): Issue => ({
  key,
  summary: draft.title,
  description: draft.description.map((claim) => claim.text).join("\n"),
  status: "To Do",
  url: published(key).url,
  updated: new Date().toISOString(),
});

const missingIssue = (key: string) => Promise.reject(new Error(`No such issue: ${key}`));

const sampleTracker: IssueTracker = {
  searchRelated: (terms, limit) =>
    Promise.resolve(
      issues()
        .filter((issue) => terms.some((term) => issue.summary.toLowerCase().includes(term)))
        .slice(0, limit),
    ),
  getIssue: (key) => {
    const issue = issues().find((item) => item.key === key);
    return issue ? Promise.resolve(issue) : missingIssue(key);
  },
  createIssue: (draft) => {
    const key = `${PROJECT_KEY}-${issues().length + 1}`;
    issues().push(issueFrom(key, draft));
    return Promise.resolve(published(key));
  },
  updateIssue: (key, draft) => {
    const list = issues();
    const index = list.findIndex((item) => item.key === key);
    if (index === -1) return missingIssue(key);
    list[index] = issueFrom(key, draft);
    return Promise.resolve(published(key));
  },
};

// Consent is instant: the "authorize" page is the app's own callback, carrying the state it was given.
const instantConsent = ({ state, redirectUri }: { state: string; redirectUri: string }) =>
  `${redirectUri}?${new URLSearchParams({ code: "sample", state })}`;

const sampleAccount = { externalId: "sample", label: "Sample account", metadata: {}, tokens: null };
const connected = () => Promise.resolve({ status: "connected" as const, accounts: [sampleAccount] });

export const fakeSourceProvider: SourceProvider = {
  id: "sample-source",
  name: "Sample repository",
  kind: "source",
  description: "A built-in repository for the end-to-end test.",
  accountNoun: "account",
  resourceNoun: "repository",
  canAddAccount: false,
  exclusive: false,
  isConfigured: () => true,
  authorizeUrl: instantConsent,
  complete: connected,
  listResources: () => Promise.resolve([{ id: REPOSITORY, label: REPOSITORY }]),
  scopeResource: (resourceId) => resourceId,
  openSource: () => Promise.resolve(sampleSource),
};

export const fakeTrackerProvider: TrackerProvider = {
  id: "sample-tracker",
  name: "Sample tracker",
  kind: "tracker",
  description: "An in-memory tracker for the end-to-end test.",
  accountNoun: "site",
  resourceNoun: "project",
  canAddAccount: false,
  exclusive: false,
  isConfigured: () => true,
  authorizeUrl: instantConsent,
  complete: connected,
  listResources: () => Promise.resolve([{ id: PROJECT_KEY, label: `${PROJECT_KEY} · Sample shop` }]),
  openTracker: () => sampleTracker,
  parseIssueKey: (_resourceId, input) => (/^SHOP-\d+$/i.test(input.trim()) ? input.trim().toUpperCase() : null),
  issueKeyExample: () => `${PROJECT_KEY}-1`,
};
