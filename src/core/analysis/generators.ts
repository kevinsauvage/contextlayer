import type { AuditBody } from "@/core/audit/schemas";
import type { ContextSource, Issue } from "@/core/context/source";
import type { Evidence } from "@/core/evidence/schemas";
import type { DraftBody, Refinement } from "@/core/requirements/schemas";

export type TokenUsage = { inputTokens: number; outputTokens: number };

// Exploration, a discarded attempt and drafting are separate model calls, but one analysis pays for all of them.
export const addUsage = (first: TokenUsage | undefined, second: TokenUsage | undefined): TokenUsage | undefined =>
  first || second
    ? {
        inputTokens: (first?.inputTokens ?? 0) + (second?.inputTokens ?? 0),
        outputTokens: (first?.outputTokens ?? 0) + (second?.outputTokens ?? 0),
      }
    : undefined;

// Calls report their usage as they finish, so a run that throws or times out still records the tokens it spent.
export type UsageMeter = {
  add: (usage: TokenUsage | undefined) => void;
  total: () => TokenUsage | undefined;
};

export const createUsageMeter = (): UsageMeter => {
  let total: TokenUsage | undefined;
  return {
    add: (usage) => {
      total = addUsage(total, usage);
    },
    total: () => total,
  };
};

export type GeneratorResult<T> = { body: T; usage?: TokenUsage };

export type DraftGenerator = {
  generate(input: {
    request: string;
    answers: Refinement[];
    candidates: Evidence[];
  }): Promise<GeneratorResult<DraftBody>>;
};

export type AuditGenerator = {
  audit(input: { issue: Issue; candidates: Evidence[] }): Promise<GeneratorResult<AuditBody>>;
};

// An agent that reads the repository through tools and names the files a draft must cite. It never returns excerpts:
// the pipeline still attaches the real ones, so a selection cannot invent a source.
export type EvidenceSelector = {
  select(input: { query: string; source: ContextSource }): Promise<{ paths: string[]; usage?: TokenUsage }>;
};
