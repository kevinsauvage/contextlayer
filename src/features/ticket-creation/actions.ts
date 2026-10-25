"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { draftTicket } from "@/core/analysis/analyze";
import { citedEvidence } from "@/core/evidence/validate";
import { clarificationSchema, draftBodySchema, draftSections, type Refinement } from "@/core/requirements/schemas";
import { parseApprovedDraft } from "@/features/analysis/approved-draft";
import { defaultGenerator, loadAnalysis, loadProject } from "@/features/analysis/context";
import { answersOf, mergeAnswers, readAnalysisInput, requestOf } from "@/features/analysis/input";
import { buildProjectContext, buildProjectTracker } from "@/features/analysis/project-context";
import { publishApproved, type PublishResult } from "@/features/analysis/publish";
import { storedEvidence } from "@/features/analysis/read";
import { restartAnalysis, startAnalysis } from "@/features/analysis/run";
import { withActionErrors } from "@/features/errors";
import type { Project } from "@/features/projects/queries";
import type { Database } from "@/infrastructure/db/client";
import { analysis } from "@/infrastructure/db/schema";
import type { ActionState } from "@/lib/action-state";
import { firstIssueMessage } from "@/lib/zod";

const requestSchema = z
  .string()
  .trim()
  .min(3, "Describe what you need in at least a few words")
  .max(4000, "Keep the request under 4,000 characters");

const draftFromRequest = async (db: Database, project: Project, request: string, answers: Refinement[] = []) => {
  const { draft, issues, usage } = await draftTicket({
    request,
    answers,
    ...(await buildProjectContext(db, project)),
    generator: defaultGenerator(),
  });
  return { result: draft, issues, usage };
};

export async function createTicketAnalysis(
  projectId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const request = requestSchema.safeParse(formData.get("request"));
  if (!request.success) return { error: firstIssueMessage(request.error) };

  const loaded = await loadProject(projectId);
  if ("error" in loaded) return loaded;
  const { db, userId, project } = loaded;

  const analysisId = await startAnalysis({
    db,
    project,
    userId,
    kind: "create",
    input: { request: request.data },
    execute: () => draftFromRequest(db, project, request.data),
  });
  redirect(`/projects/${projectId}/analyses/${analysisId}`);
}

// Until a ticket is published, refining replaces the draft instead of adding another analysis to the history.
async function redraft(
  analysisId: string,
  change: (current: { request: string; answers: Refinement[] }) => {
    request: string;
    answers: Refinement[];
  },
): Promise<ActionState> {
  return withActionErrors(async () => {
    const loaded = await loadAnalysis(analysisId, {
      kind: "create",
      publishedError: (issueKey) => `Already published as ${issueKey}`,
      runningError: "This analysis is still running",
    });
    if ("error" in loaded) return loaded;
    const { db, userId, project, analysis } = loaded;
    const input = readAnalysisInput(analysis);
    const next = change({ request: requestOf(input), answers: answersOf(input) });

    await restartAnalysis({
      db,
      userId,
      input: next.answers.length ? next : { request: next.request },
      execute: () => draftFromRequest(db, project, next.request, next.answers),
      rerunId: analysisId,
    });
    refresh();
    return {};
  });
}

// One chat turn: answers to the open questions (blank ones stay open) and an optional free-text message.
const chatTurnSchema = z.object({
  answers: z.array(clarificationSchema).max(20),
  message: z.string().trim().max(4000, "Keep the message under 4,000 characters"),
});
export type ChatTurn = z.input<typeof chatTurnSchema>;

export async function refineTicket(analysisId: string, input: unknown): Promise<ActionState> {
  const turn = chatTurnSchema.safeParse(input);
  if (!turn.success) return { error: firstIssueMessage(turn.error, "The message is invalid") };
  const { answers: round, message } = turn.data;
  if (!message && !round.some((pair) => pair.answer)) return { error: "Answer a question or describe what to change" };
  return redraft(analysisId, ({ request, answers }) => ({
    request,
    answers: [...mergeAnswers(answers, round), ...(message ? [{ message }] : [])],
  }));
}

// Autosave keeps manual edits across a reload without approving or publishing anything.
export async function saveDraftEdits(analysisId: string, draftInput: unknown): Promise<ActionState> {
  const draft = draftBodySchema.safeParse(draftInput);
  if (!draft.success) return { error: firstIssueMessage(draft.error, "The edited draft is invalid") };

  const loaded = await loadAnalysis(analysisId, {
    kind: "create",
    runningError: "This analysis is still running",
    publishedError: () => "This draft is already published",
  });
  if ("error" in loaded) return loaded;

  // Only the editable fields are stored; evidence is rebuilt from the stored result so the browser cannot add one.
  const evidence = storedEvidence(loaded.analysis);
  const [row] = await loaded.db
    .update(analysis)
    .set({ editedResult: { ...draft.data, evidence: citedEvidence(evidence, draftSections(draft.data)) } })
    .where(and(eq(analysis.id, analysisId), isNull(analysis.publishedIssueKey)))
    .returning({ id: analysis.id });
  return row ? {} : { error: "This draft is already published" };
}

export async function publishTicket(analysisId: string, draftInput: unknown): Promise<PublishResult> {
  const loaded = await loadAnalysis(analysisId, {
    kind: "create",
    status: "completed",
    publishedError: (issueKey) => `Already published as ${issueKey}`,
  });
  if ("error" in loaded) return loaded;

  const approved = parseApprovedDraft(draftInput, storedEvidence(loaded.analysis), "The draft is invalid");
  if ("error" in approved) return approved;

  return publishApproved(loaded.db, analysisId, approved.draft, async () => {
    const tracker = await buildProjectTracker(loaded.db, loaded.project);
    return tracker.createIssue(approved.draft);
  });
}
