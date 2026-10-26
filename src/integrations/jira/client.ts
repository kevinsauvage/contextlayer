import "server-only";
import ky, { HTTPError } from "ky";
import { z } from "zod";
import type { Issue, IssueTracker, PublishedIssue } from "@/core/context/source";
import { TrackerRejectedError } from "@/core/errors";
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

// Jira answers 401 when the token was revoked or the grant was removed: that needs a new consent, not a retry.
export class JiraApiError extends Error {
  constructor(
    readonly status: number,
    // The full response body: a write's field errors can run past the excerpt kept in the message.
    readonly detail: string,
  ) {
    super(`Jira API error ${status}: ${detail.slice(0, 300)}`);
  }
}

// A 400 on a write names the field Jira refused, which is far more useful than "rejected the change".
function rejectionMessage(detail: string): string {
  try {
    const body = rejectionSchema.parse(JSON.parse(detail));
    const field = Object.entries(body.errors ?? {})[0];
    if (field) return `${field[0]}: ${field[1]}`;
    return body.errorMessages?.[0] ?? "The issue tracker rejected the change.";
  } catch {
    return "The issue tracker rejected the change.";
  }
}

type JiraProject = z.infer<typeof projectPageSchema>["values"][number];

type Site = { cloudId: string; siteUrl: string };
type JiraRequest = { method?: string; body?: unknown };

async function jiraRequest(site: Site, accessToken: string, path: string, init: JiraRequest = {}): Promise<unknown> {
  try {
    const response = await ky(`https://api.atlassian.com/ex/jira/${site.cloudId}/rest/api/3${path}`, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      timeout: REQUEST_TIMEOUT_MS,
      // A 429 means Jira did not process the request, so every method is safe to retry; ky honors Retry-After.
      retry: { limit: 2, statusCodes: [429], methods: ["get", "post", "put", "delete"] },
    });
    return response.status === 204 ? null : await response.json();
  } catch (error) {
    if (!(error instanceof HTTPError)) throw error;
    const detail = typeof error.data === "string" ? error.data : JSON.stringify(error.data ?? "");
    throw new JiraApiError(error.response.status, detail);
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

  async searchRelated(terms: string[], limit: number): Promise<Issue[]> {
    const text = terms.map((term) => `text ~ ${jqlString(term)}`).join(" OR ");
    const jql = `project = ${jqlString(this.projectKey)} AND (${text}) ORDER BY updated DESC`;
    const result = await this.call("/search/jql", {
      method: "POST",
      body: { jql, fields: ISSUE_FIELDS, maxResults: limit },
    });
    return searchSchema.parse(result).issues.map((issue) => this.toIssue(issue));
  }

  async getIssue(key: string): Promise<Issue> {
    const result = await this.call(`/issue/${encodeURIComponent(key)}?fields=${ISSUE_FIELDS.join(",")}`);
    return this.toIssue(issueSchema.parse(result));
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
    const { issueTypes } = projectSchema.parse(await this.call(`/project/${encodeURIComponent(this.projectKey)}`));
    const standard = issueTypes.filter((type) => !type.subtask);
    const chosen = standard.find((type) => type.name === PREFERRED_ISSUE_TYPE) ?? standard[0];
    if (!chosen) throw new Error(`Jira project ${this.projectKey} has no usable issue type`);
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
      return await this.call(path, init);
    } catch (error) {
      if (error instanceof JiraApiError && error.status === 400)
        throw new TrackerRejectedError(rejectionMessage(error.detail));
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
