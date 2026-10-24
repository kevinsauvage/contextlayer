import "server-only";
import { and, eq, lt, ne, or } from "drizzle-orm";
import type { TokenUsage } from "@/core/analysis/generators";
import type { StoredAnalysisInput } from "@/core/analysis/schemas";
import { AnalysisAlreadyRunningError } from "@/core/errors";
import type { EvidenceIssue } from "@/core/evidence/validate";
import { STALE_ANALYSIS_MS } from "@/core/analysis/stale";
import { toActionError } from "@/features/errors";
import type { Project } from "@/features/projects/queries";
import type { Database } from "@/infrastructure/db/client";
import { analysis } from "@/infrastructure/db/schema";
import { getEnv } from "@/infrastructure/env";
import { first } from "@/lib/first";

type Outcome = { result: unknown; issues: EvidenceIssue[]; usage?: TokenUsage };

type Execute = () => Promise<Outcome>;

// Runs the model call and records its outcome; a failure lands on the row instead of escaping as an error page.
async function recordOutcome(db: Database, id: string, execute: Execute): Promise<void> {
  const startedAt = Date.now();
  try {
    const { result, issues, usage } = await execute();
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
    const known = toActionError(error);
    await db
      .update(analysis)
      .set({
        status: "failed",
        error: known?.error ?? (error instanceof Error ? error.message : String(error)),
        latencyMs: Date.now() - startedAt,
      })
      .where(eq(analysis.id, id));
  }
}

type StartArgs = {
  db: Database;
  project: Project;
  userId: string;
  kind: "create" | "audit";
  input: StoredAnalysisInput;
  execute: Execute;
};

export async function startAnalysis(args: StartArgs): Promise<string> {
  const row = first(
    await args.db
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
  await recordOutcome(args.db, row.id, args.execute);
  return row.id;
}

type RestartArgs = {
  db: Database;
  userId: string;
  input: StoredAnalysisInput;
  rerunId: string;
  execute: Execute;
};

// A re-run replaces the row's draft in place; the conditional update keeps two tabs from both spending tokens.
// A stale "running" row is allowed through: no request is left to finish it.
export async function restartAnalysis(args: RestartArgs): Promise<string> {
  const [row] = await args.db
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
    .where(
      and(
        eq(analysis.id, args.rerunId),
        or(ne(analysis.status, "running"), lt(analysis.createdAt, new Date(Date.now() - STALE_ANALYSIS_MS))),
      ),
    )
    .returning({ id: analysis.id });
  if (!row) throw new AnalysisAlreadyRunningError();
  await recordOutcome(args.db, row.id, args.execute);
  return row.id;
}
