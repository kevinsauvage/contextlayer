import type { AuditBody } from "@/core/audit/schemas";
import type { ContextSource, Issue } from "@/core/context/source";
import type { Evidence } from "@/core/evidence/schemas";
import type { DraftBody, Refinement } from "@/core/requirements/schemas";

export type TokenUsage = { inputTokens: number; outputTokens: number };
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
