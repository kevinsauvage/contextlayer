import type { TicketDraft } from "@/core/requirements/schemas";

export type LineRange = { start: number; end: number };

export type ContextSource = {
  listFiles(): Promise<string[]>;
  readFile(path: string): Promise<string>;
  searchContent?(terms: string[]): Promise<string[]>;
  urlFor?(path: string, lines?: LineRange): string;
};

export type Issue = { key: string; summary: string; description: string; status: string; url: string };
export type PublishedIssue = { key: string; url: string };

export type IssueTracker = {
  searchRelated(terms: string[], limit: number): Promise<Issue[]>;
  getIssue(key: string): Promise<Issue>;
  createIssue(draft: TicketDraft): Promise<PublishedIssue>;
  updateIssue(key: string, draft: TicketDraft): Promise<PublishedIssue>;
};
