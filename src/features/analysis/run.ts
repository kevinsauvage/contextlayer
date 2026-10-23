import "server-only";
import { eq } from "drizzle-orm";
import type { TokenUsage } from "@/core/analysis/generators";
import type { EvidenceIssue } from "@/core/evidence/validate";
import type { Project } from "@/features/projects/queries";
import type { Database } from "@/infrastructure/db/client";
import { analysis } from "@/infrastructure/db/schema";
import { getEnv } from "@/infrastructure/env";
import { first } from "@/lib/first";

type Outcome = { result: unknown; issues: EvidenceIssue[]; usage?: TokenUsage };

type RunArgs = {
  db: Database;
  project: Project;
  userId: string;
  kind: "create" | "audit";
  input: Record<string, unknown>;
  execute: () => Promise<Outcome>;
  // Re-running replaces the row's draft in place; createdAt moves to the new run.
  rerunId?: string;
};

async function startRow(args: RunArgs): Promise<string> {
  const { db } = args;
  if (args.rerunId) {
    await db
      .update(analysis)
      .set({
        status: "running",
        input: args.input,
        createdByUserId: args.userId,
        model: getEnv().AI_MODEL,
        result: null,
        editedResult: null,
        evidenceIssues: null,
        inputTokens: null,
        outputTokens: null,
        latencyMs: null,
        error: null,
        createdAt: new Date(),
      })
      .where(eq(analysis.id, args.rerunId));
    return args.rerunId;
  }
  const row = first(
    await db
      .insert(analysis)
      .values({
        projectId: args.project.id,
        createdByUserId: args.userId,
        kind: args.kind,
        input: args.input,
        model: getEnv().AI_MODEL,
      })
      .returning({ id: analysis.id }),
  );
  return row.id;
}

export async function runAnalysis(args: RunArgs): Promise<string> {
  const { db } = args;
  const id = await startRow(args);

  const startedAt = Date.now();
  try {
    const { result, issues, usage } = await args.execute();
    await db
      .update(analysis)
      .set({
        status: "completed",
        result,
        evidenceIssues: issues,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        latencyMs: Date.now() - startedAt,
      })
      .where(eq(analysis.id, id));
  } catch (error) {
    await db
      .update(analysis)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - startedAt,
      })
      .where(eq(analysis.id, id));
  }
  return id;
}
