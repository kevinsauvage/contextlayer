import type { AuditBody } from "@/core/audit/schemas";
import type { Issue } from "@/core/context/source";
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
