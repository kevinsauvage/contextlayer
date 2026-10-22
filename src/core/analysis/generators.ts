import type { AuditBody } from "@/core/audit/schemas";
import type { Issue } from "@/core/context/source";
import type { Evidence } from "@/core/evidence/schemas";
import type { DraftBody } from "@/core/requirements/schemas";

export type TokenUsage = { inputTokens: number; outputTokens: number };
export type GeneratorResult<T> = { body: T; usage?: TokenUsage };

export interface DraftGenerator {
  generate(input: { title: string; candidates: Evidence[] }): Promise<GeneratorResult<DraftBody>>;
}

export interface AuditGenerator {
  audit(input: { issue: Issue; candidates: Evidence[] }): Promise<GeneratorResult<AuditBody>>;
}
