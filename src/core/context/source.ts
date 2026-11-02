import type { TicketDraft } from "@/core/requirements/schemas";

export type LineRange = { start: number; end: number };

// A term the source could not search (a rate limit, an outage) is not a term the code lacks, so it is reported apart.
export type SearchResult = { paths: string[]; failedTerms: string[] };

export type ContextSource = {
  listFiles(): Promise<string[]>;
  readFile(path: string): Promise<string>;
  searchContent?(terms: string[]): Promise<SearchResult>;
  urlFor?(path: string, lines?: LineRange): string;
  // The commit every read came from, when the source has one; stored so a re-run can tell the code moved.
  readonly revision?: string;
};

export type Issue = {
  key: string;
  summary: string;
  description: string;
  status: string;
  url: string;
  // The tracker's last-modified timestamp, so an audit can tell whether the issue changed since it ran.
  updated?: string;
};
export type PublishedIssue = { key: string; url: string };

export type IssueTracker = {
  searchRelated(terms: string[], limit: number): Promise<Issue[]>;
  getIssue(key: string): Promise<Issue>;
  createIssue(draft: TicketDraft): Promise<PublishedIssue>;
  updateIssue(key: string, draft: TicketDraft): Promise<PublishedIssue>;
};
