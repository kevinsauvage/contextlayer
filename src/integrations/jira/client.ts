import "server-only";
import ky, { HTTPError, isKyError } from "ky";
import { z } from "zod";
import type { Issue, IssueTracker, PublishedIssue } from "@/core/context/source";
import { foldText } from "@/core/context/terms";
import { TrackerNotFoundError, TrackerRejectedError } from "@/core/errors";
import { ticketSections } from "@/core/requirements/render";
import type { TicketDraft } from "@/core/requirements/schemas";
import { adfToText, sectionsToAdf } from "./adf";

const issueSchema = z.object({
  key: z.string(),
  fields: z.object({
    summary: z.string(),
    updated: z.string().optional(),
    description: z.unknown().nullish(),
    status: z.object({ name: z.string() }).nullish(),
  }),
});
const searchSchema = z.object({ issues: z.array(issueSchema) });
const projectPageSchema = z.object({
  values: z.array(z.object({ key: z.string(), name: z.string() })),
  // Jira marks the last page; a site that omits the flag is treated as one page.
  isLast: z.boolean().optional(),
});
const projectSchema = z.object({ issueTypes: z.array(z.object({ name: z.string(), subtask: z.boolean() })) });
const projectDetailSchema = z.object({ key: z.string(), name: z.string() });
const createdSchema = z.object({ key: z.string() });
const rejectionSchema = z.object({
  errorMessages: z.array(z.string()).optional(),
  errors: z.record(z.string(), z.string()).optional(),
});

const ISSUE_FIELDS = ["summary", "description", "status", "updated"];
const PREFERRED_ISSUE_TYPE = "Task";
const PROJECTS_PER_PAGE = 100;
const REQUEST_TIMEOUT_MS = 30_000;
// One Jira answer should take well under a minute, retries and waits included.
const TOTAL_TIMEOUT_MS = 60_000;
// A retry that waits longer than this would land after the publish claim expired; the write is refused instead.
const MAX_RETRY_AFTER_S = 10;
const SEARCH_TERMS = 5;
const SEARCH_POOL = 20;

// Jira answers 401 when the token was revoked or the grant was removed: that needs a new consent, not a retry.
export class JiraApiError extends Error {
  constructor(
    readonly status: number,
    // The full response body: a write's field errors can run past the excerpt kept in the message.
    readonly detail: string,
    // Sent with a 429 so a write can say how long to wait instead of blocking on it.
    readonly retryAfterSeconds?: number,
  ) {
    super(`Jira API error ${status}: ${detail.slice(0, 300)}`);
  }
}

// Seconds from `Retry-After` (delta-seconds or an HTTP-date); undefined when Jira sent none.
function retryAfterSeconds(headers: Headers): number | undefined {
  const value = headers.get("retry-after");
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

// A refused write names the field or reason Jira gave, which is far more useful than "rejected the change".
function rejectionMessage(detail: string, fallback: string): string {
  try {
    const body = rejectionSchema.parse(JSON.parse(detail));
    const field = Object.entries(body.errors ?? {})[0];
    if (field) return `${field[0]}: ${field[1]}`;
    return body.errorMessages?.[0] ?? fallback;
  } catch {
    return fallback;
  }
}

// Short waits are retried inside the client; this message only covers a limit the write could not wait out.
function rateLimitMessage(error: JiraApiError): string {
  return error.retryAfterSeconds === undefined
    ? "Jira is rate limiting this connection; try again shortly."
    : `Jira is rate limiting this connection; try again in ${error.retryAfterSeconds} s.`;
}

// These statuses mean Jira did not write anything, so the publish claim can go and the person can act on the reason.
const REFUSALS: Record<number, (projectKey: string) => string> = {
  400: () => "The issue tracker rejected the change.",
  403: (projectKey) => `Jira refused: the connected account cannot create or edit issues in ${projectKey}.`,
  404: (projectKey) => `Jira could not find the issue or the ${projectKey} project; it may have been deleted or moved.`,
};

type JiraProject = z.infer<typeof projectPageSchema>["values"][number];

type Site = { cloudId: string; siteUrl: string };
// `write` marks a request that changes Jira: a dropped connection may hide a write that landed, so only a 429 retries it.
type JiraRequest = { method?: string; body?: unknown; write?: boolean };

// A 429 with a short Retry-After is worth waiting out; a long one is not, because the wait would outlast the publish
// claim and a reload could create the issue twice.
const isShortRateLimit = (error: Error) => {
  if (!(error instanceof HTTPError)) return false;
  const wait = retryAfterSeconds(error.response.headers);
  return wait === undefined || wait <= MAX_RETRY_AFTER_S;
};

async function jiraRequest(site: Site, accessToken: string, path: string, init: JiraRequest = {}): Promise<unknown> {
  const method = init.method ?? "GET";
  try {
    const response = await ky(`https://api.atlassian.com/ex/jira/${site.cloudId}/rest/api/3${path}`, {
      method,
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      timeout: REQUEST_TIMEOUT_MS,
      totalTimeout: TOTAL_TIMEOUT_MS,
      // A 429 means Jira did not process the request, so every method is safe to retry; ky honors Retry-After.
      retry: {
        limit: 2,
        statusCodes: [429],
        methods: ["get", "post", "put", "delete"],
        maxRetryAfter: MAX_RETRY_AFTER_S,
        shouldRetry: init.write ? ({ error }) => isShortRateLimit(error) : undefined,
      },
    });
    return response.status === 204 ? null : await response.json();
  } catch (error) {
    if (error instanceof HTTPError) {
      const detail = typeof error.data === "string" ? error.data : JSON.stringify(error.data ?? "");
      throw new JiraApiError(error.response.status, detail, retryAfterSeconds(error.response.headers));
    }
    // ky's timeout and network errors carry the Request, whose headers hold the bearer token; keep only the name and
    // message so a logged failure cannot leak the connection.
    if (isKyError(error)) throw new Error(`Jira ${method} ${path} failed: ${error.name}: ${error.message}`);
    throw error;
  }
}

export async function listJiraProjects(site: Site, accessToken: string): Promise<JiraProject[]> {
  const projects: JiraProject[] = [];
  for (let startAt = 0; ;) {
    const page = projectPageSchema.parse(
      await jiraRequest(site, accessToken, `/project/search?maxResults=${PROJECTS_PER_PAGE}&startAt=${startAt}`),
    );
    projects.push(...page.values);
    if (page.isLast !== false || !page.values.length) return projects;
    startAt += page.values.length;
  }
}

export async function getJiraProject(
  site: Site,
  accessToken: string,
  projectKey: string,
): Promise<{ key: string; name: string } | null> {
  try {
    const project = projectDetailSchema.parse(
      await jiraRequest(site, accessToken, `/project/${encodeURIComponent(projectKey)}`),
    );
    return { key: project.key, name: project.name };
  } catch (error) {
    if (error instanceof JiraApiError && error.status === 404) return null;
    throw error;
  }
}

// JQL string literal: escape backslashes before quotes so a term cannot break out of the value.
export const jqlString = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

export class JiraClient implements IssueTracker {
  constructor(
    private readonly site: Site,
    private readonly projectKey: string,
    private readonly auth: {
      accessToken: () => Promise<string>;
      // Marks the connection and throws ReconnectRequiredError; absent when the caller has no database.
      onUnauthorized?: () => Promise<never>;
    },
  ) {}

  // `text ~` ordered by recency favors issues that match any one term, so Jira returns a pool and the issues
  // that contain the most terms (a summary hit counting double) are kept.
  async searchRelated(terms: string[], limit: number): Promise<Issue[]> {
    const used = terms.slice(0, SEARCH_TERMS);
    const text = used.map((term) => `text ~ ${jqlString(term)}`).join(" OR ");
    const jql = `project = ${jqlString(this.projectKey)} AND (${text}) ORDER BY updated DESC`;
    const result = await this.call("/search/jql", {
      method: "POST",
      body: { jql, fields: ISSUE_FIELDS, maxResults: Math.max(limit, SEARCH_POOL) },
    });
    const issues = searchSchema.parse(result).issues.map((issue) => this.toIssue(issue));
    const relevance = (issue: Issue) => {
      const summary = foldText(issue.summary);
      const description = foldText(issue.description);
      return used.reduce(
        (total, term) => total + (summary.includes(term) ? 2 : 0) + (description.includes(term) ? 1 : 0),
        0,
      );
    };
    return issues
      .map((issue) => ({ issue, score: relevance(issue) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ issue }) => issue);
  }

  async getIssue(key: string): Promise<Issue> {
    try {
      const result = await this.call(`/issue/${encodeURIComponent(key)}?fields=${ISSUE_FIELDS.join(",")}`);
      return this.toIssue(issueSchema.parse(result));
    } catch (error) {
      if (error instanceof JiraApiError && (error.status === 403 || error.status === 404))
        throw new TrackerNotFoundError(`Jira has no issue ${key}, or the connected account cannot see it.`);
      throw error;
    }
  }

  async createIssue(draft: TicketDraft): Promise<PublishedIssue> {
    const fields = {
      project: { key: this.projectKey },
      summary: draft.title,
      issuetype: { name: await this.issueTypeName() },
      description: sectionsToAdf(ticketSections(draft)),
    };
    const { key } = createdSchema.parse(await this.write("/issue", { method: "POST", body: { fields } }));
    return this.published(key);
  }

  async updateIssue(key: string, draft: TicketDraft): Promise<PublishedIssue> {
    const fields = { summary: draft.title, description: sectionsToAdf(ticketSections(draft)) };
    await this.write(`/issue/${encodeURIComponent(key)}`, { method: "PUT", body: { fields } });
    return this.published(key);
  }

  private async issueTypeName(): Promise<string> {
    let issueTypes: z.infer<typeof projectSchema>["issueTypes"];
    try {
      ({ issueTypes } = projectSchema.parse(await this.call(`/project/${encodeURIComponent(this.projectKey)}`)));
    } catch (error) {
      if (error instanceof JiraApiError && (error.status === 403 || error.status === 404))
        throw new TrackerRejectedError(
          `Jira could not find the ${this.projectKey} project, or the connected account cannot see it.`,
        );
      throw error;
    }
    const standard = issueTypes.filter((type) => !type.subtask);
    const chosen = standard.find((type) => type.name === PREFERRED_ISSUE_TYPE) ?? standard[0];
    if (!chosen) throw new TrackerRejectedError(`The ${this.projectKey} project has no issue type a ticket can use.`);
    return chosen.name;
  }

  private async call(path: string, init: JiraRequest = {}): Promise<unknown> {
    try {
      return await jiraRequest(this.site, await this.auth.accessToken(), path, init);
    } catch (error) {
      if (error instanceof JiraApiError && error.status === 401 && this.auth.onUnauthorized) {
        return this.auth.onUnauthorized();
      }
      throw error;
    }
  }

  private async write(path: string, init: JiraRequest): Promise<unknown> {
    try {
      return await this.call(path, { ...init, write: true });
    } catch (error) {
      if (error instanceof JiraApiError && error.status === 429)
        throw new TrackerRejectedError(rateLimitMessage(error));
      const refusal = error instanceof JiraApiError ? REFUSALS[error.status] : undefined;
      if (refusal && error instanceof JiraApiError)
        throw new TrackerRejectedError(rejectionMessage(error.detail, refusal(this.projectKey)));
      throw error;
    }
  }

  private published = (key: string): PublishedIssue => ({ key, url: `${this.site.siteUrl}/browse/${key}` });

  private toIssue(issue: z.infer<typeof issueSchema>): Issue {
    return {
      key: issue.key,
      summary: issue.fields.summary,
      description: adfToText(issue.fields.description).trim(),
      status: issue.fields.status?.name ?? "Unknown",
      url: `${this.site.siteUrl}/browse/${issue.key}`,
      updated: issue.fields.updated,
    };
  }
}
