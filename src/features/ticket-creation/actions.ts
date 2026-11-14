"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { draftTicket } from "@/core/analysis/analyze";
import type { TokenUsage } from "@/core/analysis/generators";
import { withCitedEvidence } from "@/core/evidence/validate";
import { boundRefinements, clarificationSchema, editedDraftSchema, type Refinement } from "@/core/requirements/schemas";
import { parseApprovedDraft } from "@/features/analysis/approved-draft";
import { defaultGenerator, defaultSelector, loadAnalysis, loadProject } from "@/features/analysis/context";
import { answersOf, mergeAnswers, readAnalysisInput, requestOf } from "@/features/analysis/input";
import { buildProjectContext, buildProjectTracker } from "@/features/analysis/project-context";
import { publishApproved, type PublishResult } from "@/features/analysis/publish";
import { storedDraft, storedEvidence } from "@/features/analysis/read";
import { restartAnalysis, startAnalysis } from "@/features/analysis/run";
import { withActionErrors } from "@/features/errors";
import type { Analysis, Project } from "@/features/projects/queries";
import type { Database } from "@/infrastructure/db/client";
import { analysis } from "@/infrastructure/db/schema";
import type { ActionState } from "@/lib/action-state";
import { formString } from "@/lib/form";
import { firstIssueMessage } from "@/lib/zod";

const REGENERATED_ERROR = "The draft was regenerated or published since you edited it; reload the page";

const requestSchema = z
  .string()
  .trim()
  .min(3, "Describe what you need in at least a few words")
  .max(4000, "Keep the request under 4,000 characters");

const draftFromRequest = async (
  db: Database,
  project: Project,
  deadline: AbortSignal,
  request: string,
  answers: Refinement[] = [],
  onUsage?: (usage: TokenUsage) => void,
) => {
  const { draft, issues, usage, revision } = await draftTicket({
    request,
    answers,
    ...(await buildProjectContext(db, project, deadline)),
    generator: defaultGenerator(deadline, onUsage),
    selector: defaultSelector(deadline, onUsage),
  });
  return { result: draft, issues, usage, revision };
};

export async function createTicketAnalysis(
  projectId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const request = requestSchema.safeParse(formString(formData, "request"));
  if (!request.success) return { error: firstIssueMessage(request.error) };

  return withActionErrors(async () => {
    const loaded = await loadProject(projectId);
    if ("error" in loaded) return loaded;
    const { db, userId, project } = loaded;

    const analysisId = await startAnalysis({
      db,
      project,
      userId,
      kind: "create",
      input: { request: request.data },
      execute: (deadline, onUsage) => draftFromRequest(db, project, deadline, request.data, [], onUsage),
    });
    redirect(`/projects/${projectId}/analyses/${analysisId}`);
  });
}

// Until a ticket is published, refining replaces the draft instead of adding another analysis to the history.
type RedraftChange = (
  current: { request: string; answers: Refinement[] },
  analysis: Analysis,
) => { request: string; answers: Refinement[] } | { error: string };

async function redraft(analysisId: string, change: RedraftChange): Promise<ActionState> {
  return withActionErrors(async () => {
    const loaded = await loadAnalysis(analysisId, {
      kind: "create",
      publishedError: (issueKey) => `Already published as ${issueKey}`,
      runningError: "This analysis is still running",
    });
    if ("error" in loaded) return loaded;
    const { db, userId, project, analysis } = loaded;
    const input = readAnalysisInput(analysis);
    const next = change({ request: requestOf(input), answers: answersOf(input) }, analysis);
    if ("error" in next) return next;

    await restartAnalysis({
      db,
      userId,
      input: next.answers.length ? next : { request: next.request },
      execute: (deadline, onUsage) => draftFromRequest(db, project, deadline, next.request, next.answers, onUsage),
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

// The UI sends back the question text it rendered, so whitespace and case are the only differences that matter.
const normalizeQuestion = (question: string) => question.replace(/\s+/g, " ").trim().toLowerCase();

export async function refineTicket(analysisId: string, input: unknown): Promise<ActionState> {
  const turn = chatTurnSchema.safeParse(input);
  if (!turn.success) return { error: firstIssueMessage(turn.error, "The message is invalid") };
  const { answers: round, message } = turn.data;
  if (!message && !round.some((pair) => pair.answer)) return { error: "Answer a question or describe what to change" };
  return redraft(analysisId, ({ request, answers }, analysis) => {
    const asked = new Set((storedDraft(analysis)?.openQuestions ?? []).map((item) => normalizeQuestion(item.question)));
    const accepted = round.filter((pair) => asked.has(normalizeQuestion(pair.question)));
    if (!message && !accepted.some((pair) => pair.answer))
      return { error: "Those questions are no longer in the draft. Reload the page before answering." };
    return {
      request,
      answers: boundRefinements([...mergeAnswers(answers, accepted), ...(message ? [{ message }] : [])]),
    };
  });
}

// A failed run keeps the previous draft on screen; retrying re-runs the stored input without inventing a chat message.
export async function retryAnalysis(analysisId: string): Promise<ActionState> {
  return redraft(analysisId, ({ request, answers }) => ({ request, answers }));
}

// Autosave keeps manual edits across a reload without approving or publishing anything.
// `runToken` names the run the browser edited. The update itself requires it, so an autosave that lands after a redraft
// started (another tab, a queued request) cannot write the old edits over the new draft.
export async function saveDraftEdits(analysisId: string, runToken: string, draftInput: unknown): Promise<ActionState> {
  const draft = editedDraftSchema.safeParse(draftInput);
  if (!draft.success) return { error: firstIssueMessage(draft.error, "The edited draft is invalid") };

  const loaded = await loadAnalysis(analysisId, {
    kind: "create",
    runningError: "This analysis is still running",
    publishedError: () => "This draft is already published",
  });
  if ("error" in loaded) return loaded;
  if ((loaded.analysis.runToken ?? "") !== runToken) return { error: REGENERATED_ERROR };

  // Only the editable fields are stored; evidence is rebuilt from the stored result so the browser cannot add one.
  const evidence = storedEvidence(loaded.analysis);
  const [row] = await loaded.db
    .update(analysis)
    .set({ editedResult: withCitedEvidence(draft.data, evidence) })
    .where(
      and(
        eq(analysis.id, analysisId),
        eq(analysis.runToken, runToken),
        eq(analysis.status, "completed"),
        isNull(analysis.publishedIssueKey),
      ),
    )
    .returning({ id: analysis.id });
  return row ? {} : { error: REGENERATED_ERROR };
}

export async function publishTicket(analysisId: string, runToken: string, draftInput: unknown): Promise<PublishResult> {
  const loaded = await loadAnalysis(analysisId, {
    kind: "create",
    status: "completed",
    publishedError: (issueKey) => `Already published as ${issueKey}`,
  });
  if ("error" in loaded) return loaded;
  if ((loaded.analysis.runToken ?? "") !== runToken) return { error: REGENERATED_ERROR };

  const approved = parseApprovedDraft(draftInput, storedEvidence(loaded.analysis), "The draft is invalid");
  if ("error" in approved) return approved;

  return publishApproved(loaded.db, analysisId, runToken, approved.draft, async () => {
    const tracker = await buildProjectTracker(loaded.db, loaded.project);
    return tracker.createIssue(approved.draft);
  });
}
