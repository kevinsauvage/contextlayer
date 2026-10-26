import "server-only";
import { and, eq, lt, ne, or, sql } from "drizzle-orm";
import type { TokenUsage } from "@/core/analysis/generators";
import { estimateCostUsd } from "@/core/analysis/pricing";
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

type Outcome = { result: unknown; issues: EvidenceIssue[]; usage?: TokenUsage; revision?: string };

type Execute = () => Promise<Outcome>;

// Writes land only while the row still carries the run's token: a run replaced by a re-run must not
// overwrite the newer result when it finishes late.
async function applyOutcome(
  db: Database,
  id: string,
  runToken: string,
  changes: Partial<typeof analysis.$inferInsert>,
): Promise<void> {
  const rows = await db
    .update(analysis)
    .set(changes)
    .where(and(eq(analysis.id, id), eq(analysis.runToken, runToken)))
    .returning({ id: analysis.id });
  if (!rows.length) console.warn(`[analysis] dropped the outcome of a superseded run for ${id}`);
}

// Runs the model call and records its outcome; a failure lands on the row instead of escaping as an error page.
async function recordOutcome(
  db: Database,
  id: string,
  runToken: string,
  model: string,
  execute: Execute,
): Promise<void> {
  const startedAt = Date.now();
  try {
    const { result, issues, usage, revision } = await execute();
    await applyOutcome(db, id, runToken, {
      status: "completed",
      result,
      sourceRevision: revision ?? null,
      evidenceIssues: issues,
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      costUsd: estimateCostUsd(model, usage),
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    const known = toActionError(error);
    await applyOutcome(db, id, runToken, {
      status: "failed",
      error: known?.error ?? (error instanceof Error ? error.message : String(error)),
      latencyMs: Date.now() - startedAt,
    });
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
  const runToken = crypto.randomUUID();
  const model = getEnv().AI_MODEL;
  const row = first(
    await args.db
      .insert(analysis)
      .values({
        projectId: args.project.id,
        createdByUserId: args.userId,
        kind: args.kind,
        input: args.input,
        model,
        runToken,
      })
      .returning({ id: analysis.id }),
  );
  await recordOutcome(args.db, row.id, runToken, model, args.execute);
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
  const runToken = crypto.randomUUID();
  const model = getEnv().AI_MODEL;
  const [row] = await args.db
    .update(analysis)
    .set({
      status: "running",
      input: args.input,
      createdByUserId: args.userId,
      model,
      runToken,
      startedAt: new Date(),
      // Kept across a failed re-run too, so the next draft still compares with the last one that read the code.
      previousSourceRevision: sql`coalesce(${analysis.sourceRevision}, ${analysis.previousSourceRevision})`,
      sourceRevision: null,
      result: null,
      editedResult: null,
      evidenceIssues: null,
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      latencyMs: null,
      error: null,
    })
    .where(
      and(
        eq(analysis.id, args.rerunId),
        or(ne(analysis.status, "running"), lt(analysis.startedAt, new Date(Date.now() - STALE_ANALYSIS_MS))),
      ),
    )
    .returning({ id: analysis.id });
  if (!row) throw new AnalysisAlreadyRunningError();
  await recordOutcome(args.db, row.id, runToken, model, args.execute);
  return row.id;
}
