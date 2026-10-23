import { generateText, Output } from "ai";
import { z } from "zod";
import type { AuditGenerator, DraftGenerator, GeneratorResult } from "@/core/analysis/generators";
import { auditBodySchema } from "@/core/audit/schemas";
import { draftBodySchema } from "@/core/requirements/schemas";
import { getEnv } from "@/infrastructure/env";
import { resolveModel } from "./model";
import { AUDIT_SYSTEM_PROMPT, buildAuditPrompt, buildCreatePrompt, CREATE_SYSTEM_PROMPT } from "./prompt";

const jsonSchemaInstruction = (schema: z.ZodType) =>
  `Respond with a single JSON object that matches this JSON Schema:\n${JSON.stringify(z.toJSONSchema(schema))}`;

export const withSchemaInstruction = (text: string, schema: z.ZodType) =>
  getEnv().AI_STRUCTURED_OUTPUTS ? text : `${text}\n\n${jsonSchemaInstruction(schema)}`;

export class AiGenerator implements DraftGenerator, AuditGenerator {
  constructor(private readonly modelId: string) {}

  generate({ request, candidates }: Parameters<DraftGenerator["generate"]>[0]) {
    return this.run(CREATE_SYSTEM_PROMPT, buildCreatePrompt(request, candidates), draftBodySchema);
  }

  audit({ issue, candidates }: Parameters<AuditGenerator["audit"]>[0]) {
    return this.run(AUDIT_SYSTEM_PROMPT, buildAuditPrompt(issue, candidates), auditBodySchema);
  }

  private async run<T>(system: string, prompt: string, schema: z.ZodType<T>): Promise<GeneratorResult<T>> {
    const { output, usage } = await generateText({
      model: resolveModel(this.modelId),
      instructions: withSchemaInstruction(system, schema),
      prompt,
      output: Output.object({ schema }),
    });
    return { body: output, usage: { inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0 } };
  }
}
