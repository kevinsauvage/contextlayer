import type { IssueTracker } from "@/core/context/source";

export const noIssues: IssueTracker = {
  searchRelated: async () => [],
  getIssue: async (key) => ({ key, summary: "", description: "", status: "To Do", url: `https://jira.test/browse/${key}` }),
  createIssue: async () => ({ key: "X-1", url: "https://jira.test/browse/X-1" }),
  updateIssue: async (key) => ({ key, url: `https://jira.test/browse/${key}` }),
};
