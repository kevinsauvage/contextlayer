import "server-only";
import { z } from "zod";
import type { Issue, IssueTracker, PublishedIssue } from "@/core/context/source";
import { ticketSections } from "@/core/requirements/render";
import type { TicketDraft } from "@/core/requirements/schemas";
import { adfToText, sectionsToAdf } from "./adf";

const issueSchema = z.object({
  key: z.string(),
  fields: z.object({
    summary: z.string(),
    description: z.unknown().nullish(),
    status: z.object({ name: z.string() }).nullish(),
  }),
});
const searchSchema = z.object({ issues: z.array(issueSchema) });
const projectsSchema = z.object({ values: z.array(z.object({ key: z.string(), name: z.string() })) });
const projectSchema = z.object({ issueTypes: z.array(z.object({ name: z.string(), subtask: z.boolean() })) });
const createdSchema = z.object({ key: z.string() });

const ISSUE_FIELDS = ["summary", "description", "status"];
const PREFERRED_ISSUE_TYPE = "Task";

export class JiraApiError extends Error {
  constructor(readonly status: number, detail: string) {
    super(`Jira API error ${status}: ${detail}`);
  }
}

export type JiraProject = z.infer<typeof projectsSchema>["values"][number];

type Site = { cloudId: string; siteUrl: string };
type JiraRequest = { method?: string; body?: unknown };

async function jiraRequest(site: Site, accessToken: string, path: string, init: JiraRequest = {}): Promise<unknown> {
  const response = await fetch(`https://api.atlassian.com/ex/jira/${site.cloudId}/rest/api/3${path}`, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!response.ok) throw new JiraApiError(response.status, (await response.text()).slice(0, 300));
  return response.status === 204 ? null : response.json();
}

export async function listJiraProjects(site: Site, accessToken: string): Promise<JiraProject[]> {
  return projectsSchema.parse(await jiraRequest(site, accessToken, "/project/search?maxResults=100")).values;
}

export class JiraClient implements IssueTracker {
  constructor(
    private readonly site: Site,
    private readonly projectKey: string,
    private readonly accessToken: () => Promise<string>,
  ) {}

  async searchRelated(terms: string[], limit: number): Promise<Issue[]> {
    const text = terms.map((term) => `text ~ "${term}"`).join(" OR ");
    const jql = `project = "${this.projectKey}" AND (${text}) ORDER BY updated DESC`;
    const result = await this.call("/search/jql", { method: "POST", body: { jql, fields: ISSUE_FIELDS, maxResults: limit } });
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
    const { key } = createdSchema.parse(await this.call("/issue", { method: "POST", body: { fields } }));
    return this.published(key);
  }

  async updateIssue(key: string, draft: TicketDraft): Promise<PublishedIssue> {
    const fields = { summary: draft.title, description: sectionsToAdf(ticketSections(draft)) };
    await this.call(`/issue/${encodeURIComponent(key)}`, { method: "PUT", body: { fields } });
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
    return jiraRequest(this.site, await this.accessToken(), path, init);
  }

  private published = (key: string): PublishedIssue => ({ key, url: `${this.site.siteUrl}/browse/${key}` });

  private toIssue(issue: z.infer<typeof issueSchema>): Issue {
    return {
      key: issue.key,
      summary: issue.fields.summary,
      description: adfToText(issue.fields.description).trim(),
      status: issue.fields.status?.name ?? "Unknown",
      url: `${this.site.siteUrl}/browse/${issue.key}`,
    };
  }
}
