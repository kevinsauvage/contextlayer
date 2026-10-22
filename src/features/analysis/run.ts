import "server-only";
import { eq } from "drizzle-orm";
import type { TokenUsage } from "@/core/analysis/generators";
import type { EvidenceIssue } from "@/core/evidence/validate";
import type { Project } from "@/features/projects/queries";
import type { Database } from "@/infrastructure/db/client";
import { analysis } from "@/infrastructure/db/schema";
import { getEnv } from "@/infrastructure/env";

type Outcome = { result: unknown; issues: EvidenceIssue[]; usage?: TokenUsage };

export async function runAnalysis(args: {
  db: Database;
  project: Project;
  userId: string;
  kind: "create" | "audit";
  input: Record<string, string>;
  execute: () => Promise<Outcome>;
}): Promise<string> {
  const { db } = args;
  const [row] = await db
    .insert(analysis)
    .values({ projectId: args.project.id, createdByUserId: args.userId, kind: args.kind, input: args.input, model: getEnv().AI_MODEL })
    .returning({ id: analysis.id });

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
      .where(eq(analysis.id, row.id));
  } catch (error) {
    await db
      .update(analysis)
      .set({ status: "failed", error: error instanceof Error ? error.message : String(error), latencyMs: Date.now() - startedAt })
      .where(eq(analysis.id, row.id));
  }
  return row.id;
}
