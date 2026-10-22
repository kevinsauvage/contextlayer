import { generateText, Output } from "ai";
import type { z } from "zod";
import type { AuditGenerator, DraftGenerator, GeneratorResult } from "@/core/analysis/generators";
import { auditBodySchema } from "@/core/audit/schemas";
import { draftBodySchema } from "@/core/requirements/schemas";
import { AUDIT_SYSTEM_PROMPT, buildAuditPrompt, buildCreatePrompt, CREATE_SYSTEM_PROMPT } from "./prompt";

export class AiGenerator implements DraftGenerator, AuditGenerator {
  constructor(private readonly model: string) {}

  generate({ title, candidates }: Parameters<DraftGenerator["generate"]>[0]) {
    return this.run(CREATE_SYSTEM_PROMPT, buildCreatePrompt(title, candidates), draftBodySchema);
  }

  audit({ issue, candidates }: Parameters<AuditGenerator["audit"]>[0]) {
    return this.run(AUDIT_SYSTEM_PROMPT, buildAuditPrompt(issue, candidates), auditBodySchema);
  }

  private async run<T>(system: string, prompt: string, schema: z.ZodType<T>): Promise<GeneratorResult<T>> {
    const { output, usage } = await generateText({ model: this.model, system, prompt, output: Output.object({ schema }) });
    return { body: output, usage: { inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0 } };
  }
}
