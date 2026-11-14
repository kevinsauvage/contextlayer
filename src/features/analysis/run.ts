import "server-only";
import { and, eq, lt, ne, or, sql } from "drizzle-orm";
import type { TokenUsage } from "@/core/analysis/generators";
import { createUsageMeter } from "@/core/analysis/generators";
import type { StoredAnalysisInput } from "@/core/analysis/schemas";
import { AnalysisAlreadyRunningError, errorSummary } from "@/core/errors";
import type { EvidenceIssue } from "@/core/evidence/validate";
import { RUN_BUDGET_MS, RUN_TIMEOUT_ERROR, STALE_ANALYSIS_MS } from "@/core/analysis/stale";
import { claimRun, runLimitsOf } from "@/features/analysis/limits";
import { toActionError } from "@/features/errors";
import type { Project } from "@/features/projects/queries";
import type { Database } from "@/infrastructure/db/client";
import { analysis } from "@/infrastructure/db/schema";
import { getEnv } from "@/infrastructure/env";
import { first } from "@/lib/first";

type Outcome = { result: unknown; issues: EvidenceIssue[]; usage?: TokenUsage; revision?: string };

// The signal aborts at the run's deadline; model calls take it so the run ends before the host kills the request.
// `onUsage` lets a model call report tokens as it finishes, so a failed run still records what it spent.
type Execute = (deadline: AbortSignal, onUsage: (usage: TokenUsage) => void) => Promise<Outcome>;

// Provider, GitHub and database messages can carry internal URLs, ids or model output, so members see this instead.
export const UNEXPECTED_RUN_ERROR =
  "The analysis failed. Try again; if it keeps failing, ask an admin to check the logs.";

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
async function recordOutcome(db: Database, id: string, runToken: string, execute: Execute): Promise<void> {
  const startedAt = Date.now();
  const deadline = AbortSignal.timeout(RUN_BUDGET_MS);
  const meter = createUsageMeter();
  try {
    const { result, issues, usage, revision } = await execute(deadline, meter.add);
    // A fake provider reports its usage only in the outcome; a real one reports every call as it finishes.
    const total = meter.total() ?? usage;
    await applyOutcome(db, id, runToken, {
      status: "completed",
      result,
      // The new draft replaces the previous one and any edits made to it.
      editedResult: null,
      sourceRevision: revision ?? null,
      evidenceIssues: issues,
      inputTokens: total?.inputTokens,
      outputTokens: total?.outputTokens,
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    const known = toActionError(error);
    if (!known) console.error(`[analysis] run ${id} failed`, errorSummary(error));
    // The run's own deadline, the agent's 90 s cap and each model call's cap all mean the same thing to the user.
    const timedOut = deadline.aborted || (error instanceof Error && error.name === "TimeoutError");
    const total = meter.total();
    await applyOutcome(db, id, runToken, {
      status: "failed",
      error: timedOut ? RUN_TIMEOUT_ERROR : (known?.error ?? UNEXPECTED_RUN_ERROR),
      inputTokens: total?.inputTokens,
      outputTokens: total?.outputTokens,
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
  const env = getEnv();
  const row = await claimRun(args.db, args.userId, runLimitsOf(env), async (tx) =>
    first(
      await tx
        .insert(analysis)
        .values({
          projectId: args.project.id,
          createdByUserId: args.userId,
          kind: args.kind,
          input: args.input,
          model: env.AI_MODEL,
          runToken,
        })
        .returning({ id: analysis.id }),
    ),
  );
  await recordOutcome(args.db, row.id, runToken, args.execute);
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
  const env = getEnv();
  const row = await claimRun(args.db, args.userId, runLimitsOf(env), async (tx) => {
    const [claimed] = await tx
      .update(analysis)
      .set({
        status: "running",
        input: args.input,
        model: env.AI_MODEL,
        runToken,
        startedAt: new Date(),
        // Kept across a failed re-run too, so the next draft still compares with the last one that read the code.
        previousSourceRevision: sql`coalesce(${analysis.sourceRevision}, ${analysis.previousSourceRevision})`,
        sourceRevision: null,
        inputTokens: null,
        outputTokens: null,
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
    if (!claimed) throw new AnalysisAlreadyRunningError();
    return claimed;
  });
  await recordOutcome(args.db, row.id, runToken, args.execute);
  return row.id;
}
