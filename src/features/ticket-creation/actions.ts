"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { draftTicket } from "@/core/analysis/analyze";
import { clarificationSchema, type Clarification } from "@/core/requirements/schemas";
import { parseApprovedDraft } from "@/features/analysis/approved-draft";
import { defaultGenerator, loadAnalysis, loadProject } from "@/features/analysis/context";
import { answersOf, mergeAnswers, readAnalysisInput, requestOf } from "@/features/analysis/input";
import { buildProjectContext } from "@/features/analysis/project-context";
import { publishApproved, type PublishResult } from "@/features/analysis/publish";
import { restartAnalysis, startAnalysis } from "@/features/analysis/run";
import { withActionErrors } from "@/features/errors";
import type { Project } from "@/features/projects/queries";
import type { Database } from "@/infrastructure/db/client";
import type { ActionState } from "@/lib/action-state";
import { firstIssueMessage } from "@/lib/zod";

const requestSchema = z
  .string()
  .trim()
  .min(3, "Describe what you need in at least a few words")
  .max(4000, "Keep the request under 4,000 characters");

const draftFromRequest = async (db: Database, project: Project, request: string, answers: Clarification[] = []) => {
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
  change: (current: { request: string; answers: Clarification[] }) => {
    request: string;
    answers: Clarification[];
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

export async function rerunTicketAnalysis(
  analysisId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const request = requestSchema.safeParse(formData.get("request"));
  if (!request.success) return { error: firstIssueMessage(request.error) };
  return redraft(analysisId, ({ answers }) => ({ request: request.data, answers: answers.filter((a) => a.answer) }));
}

const answersSchema = z.array(clarificationSchema).max(20);

export async function answerQuestions(analysisId: string, input: unknown): Promise<ActionState> {
  const round = answersSchema.safeParse(input);
  if (!round.success) return { error: firstIssueMessage(round.error, "The answers are invalid") };
  if (!round.data.some((pair) => pair.answer)) return { error: "Answer at least one question, or publish as is" };
  return redraft(analysisId, ({ request, answers }) => ({ request, answers: mergeAnswers(answers, round.data) }));
}

export async function publishTicket(analysisId: string, draftInput: unknown): Promise<PublishResult> {
  const approved = parseApprovedDraft(draftInput, "The draft is invalid");
  if ("error" in approved) return approved;

  const loaded = await loadAnalysis(analysisId, {
    kind: "create",
    status: "completed",
    publishedError: (issueKey) => `Already published as ${issueKey}`,
  });
  if ("error" in loaded) return loaded;

  return publishApproved(loaded.db, analysisId, approved.draft, async () =>
    (await buildProjectContext(loaded.db, loaded.project)).tracker.createIssue(approved.draft),
  );
}
