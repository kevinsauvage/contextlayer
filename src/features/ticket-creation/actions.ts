"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { draftTicket } from "@/core/analysis/analyze";
import { clarificationSchema, type Clarification } from "@/core/requirements/schemas";
import { parseApprovedDraft } from "@/features/analysis/approved-draft";
import { analysisAnswers, analysisRequest, mergeAnswers } from "@/features/analysis/input";
import { buildProjectContext } from "@/features/analysis/project-context";
import { publishApproved, type PublishResult } from "@/features/analysis/publish";
import { runAnalysis } from "@/features/analysis/run";
import { withActionErrors } from "@/features/errors";
import { getAnalysis, getProject, type Project } from "@/features/projects/queries";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb, type Database } from "@/infrastructure/db/client";
import { getEnv } from "@/infrastructure/env";
import { AiGenerator } from "@/integrations/ai/generator";
import type { ActionState } from "@/lib/action-state";
import { firstIssueMessage } from "@/lib/zod";

const requestSchema = z
  .string()
  .trim()
  .min(3, "Describe what you need in at least a few words")
  .max(4000, "Keep the request under 4,000 characters");

const draftFromRequest =
  (db: Database, project: Project, request: string, answers: Clarification[] = []) =>
  async () => {
    const { draft, issues, usage } = await draftTicket({
      request,
      answers,
      ...(await buildProjectContext(db, project)),
      generator: new AiGenerator(getEnv().AI_MODEL),
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

  const { organizationId, userId } = await requireOrgContext();
  const db = getDb();
  const project = await getProject(db, organizationId, projectId);
  if (!project) return { error: "Project not found" };

  const analysisId = await runAnalysis({
    db,
    project,
    userId,
    kind: "create",
    input: { request: request.data },
    execute: draftFromRequest(db, project, request.data),
  });
  redirect(`/projects/${projectId}/analyses/${analysisId}`);
}

async function findRefinable(analysisId: string) {
  const { organizationId, userId } = await requireOrgContext();
  const db = getDb();
  const found = await getAnalysis(db, organizationId, analysisId);
  if (found?.analysis.kind !== "create") return { error: "Analysis not found" };
  if (found.analysis.publishedIssueKey) return { error: `Already published as ${found.analysis.publishedIssueKey}` };
  if (found.analysis.status === "running") return { error: "This analysis is still running" };
  return { db, userId, found };
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
    const refinable = await findRefinable(analysisId);
    if ("error" in refinable) return refinable;
    const { db, userId, found } = refinable;
    const next = change({
      request: analysisRequest(found.analysis.input),
      answers: analysisAnswers(found.analysis.input),
    });

    await runAnalysis({
      db,
      project: found.project,
      userId,
      kind: "create",
      input: next.answers.length ? next : { request: next.request },
      execute: draftFromRequest(db, found.project, next.request, next.answers),
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
  if ("error" in approved) return { error: approved.error };

  const { organizationId } = await requireOrgContext();
  const db = getDb();
  const found = await getAnalysis(db, organizationId, analysisId);
  if (found?.analysis.kind !== "create" || found.analysis.status !== "completed")
    return { error: "Analysis not found" };
  if (found.analysis.publishedIssueKey) return { error: `Already published as ${found.analysis.publishedIssueKey}` };

  return publishApproved(db, analysisId, approved.draft, async () =>
    (await buildProjectContext(db, found.project)).tracker.createIssue(approved.draft),
  );
}
