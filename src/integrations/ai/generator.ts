import { generateText, NoObjectGeneratedError, Output } from "ai";
import pRetry from "p-retry";
import { z } from "zod";
import {
  addUsage,
  type AuditGenerator,
  type DraftGenerator,
  type GeneratorResult,
  type TokenUsage,
} from "@/core/analysis/generators";
import { auditBodySchema } from "@/core/audit/schemas";
import { draftBodySchema } from "@/core/requirements/schemas";
import { getEnv } from "@/infrastructure/env";
import { resolveModel } from "./model";
import { tokenUsage } from "./usage";
import { AUDIT_SYSTEM_PROMPT, buildAuditPrompt, buildCreatePrompt, CREATE_SYSTEM_PROMPT } from "./prompt";

const MODEL_TIMEOUT_MS = 120_000;

const jsonSchemaInstruction = (schema: z.ZodType) =>
  `Respond with a single JSON object that matches this JSON Schema:\n${JSON.stringify(z.toJSONSchema(schema))}`;

export const withSchemaInstruction = (
  text: string,
  schema: z.ZodType,
  structuredOutputs = getEnv().AI_STRUCTURED_OUTPUTS,
) => (structuredOutputs ? text : `${text}\n\n${jsonSchemaInstruction(schema)}`);

export class AiGenerator implements DraftGenerator, AuditGenerator {
  // `deadline` ends the run as a whole: it stops a call in flight and a retry the run has no time left for.
  // `onUsage` hears about every billed call, including one whose answer is thrown away.
  constructor(
    private readonly modelId: string,
    private readonly deadline?: AbortSignal,
    private readonly onUsage?: (usage: TokenUsage) => void,
  ) {}

  generate({ request, answers, candidates }: Parameters<DraftGenerator["generate"]>[0]) {
    return this.run(CREATE_SYSTEM_PROMPT, buildCreatePrompt(request, answers, candidates), draftBodySchema);
  }

  audit({ issue, candidates }: Parameters<AuditGenerator["audit"]>[0]) {
    return this.run(AUDIT_SYSTEM_PROMPT, buildAuditPrompt(issue, candidates), auditBodySchema);
  }

  private async run<T>(system: string, prompt: string, schema: z.ZodType<T>): Promise<GeneratorResult<T>> {
    // A malformed or schema-invalid answer is usually a one-off, so it gets one more try; other errors fail at once.
    // The discarded answer was billed too, so its tokens count toward the run.
    let discarded: TokenUsage | undefined;
    const { output, usage } = await pRetry(
      () =>
        generateText({
          model: resolveModel(this.modelId),
          instructions: withSchemaInstruction(system, schema),
          prompt,
          output: Output.object({ schema }),
          timeout: MODEL_TIMEOUT_MS,
          abortSignal: this.deadline,
        }),
      {
        retries: 1,
        signal: this.deadline,
        shouldRetry: ({ error }) => NoObjectGeneratedError.isInstance(error),
        onFailedAttempt: ({ error }) => {
          if (!NoObjectGeneratedError.isInstance(error) || !error.usage) return;
          const used = tokenUsage(error.usage);
          discarded = addUsage(discarded, used);
          this.onUsage?.(used);
        },
      },
    );
    this.onUsage?.(tokenUsage(usage));
    return { body: output, usage: addUsage(discarded, tokenUsage(usage)) };
  }
}
