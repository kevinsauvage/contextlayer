import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { auditIssue, draftTicket, type AuditResult, type CreationResult } from "@/core/analysis/analyze";
import type { Evidence } from "@/core/evidence/schemas";
import { AiEvidenceAgent } from "@/integrations/ai/evidence-agent";
import { AiGenerator } from "@/integrations/ai/generator";
import type { GitSource } from "@/integrations/git/git-source";
import { getEnv } from "@/infrastructure/env";
import { requestOf, sourceOf, trackerOf, type LoadedCase } from "./fixtures";
import type { Verdict } from "./judge";

export const RESULTS_DIR = path.join(import.meta.dirname, "results");

const resultPath = (id: string) => path.join(RESULTS_DIR, `${id}.json`);

type CaseRun =
  // `text` is what a judge reads: the draft for a ticket, or the report for an audit.
  { kind: "create"; result: CreationResult; text: string } | { kind: "audit"; result: AuditResult; text: string };

type CaseMetrics = { latencyMs: number; retrievalRecall: number };

// The judge sees the evidence too, so it can check what findings cite.
const auditText = (report: AuditResult["report"]) =>
  JSON.stringify(
    {
      summary: report.summary,
      findings: report.findings,
      proposedTicket: report.proposedTicket,
      evidence: report.evidence,
    },
    null,
    2,
  );

// The ticket text a reader sees, without evidence excerpts: an excerpt quotes the repository verbatim, so injected
// text may legitimately appear there even when the draft never uses it.
const outputText = (run: CaseRun): string =>
  run.kind === "create"
    ? JSON.stringify({
        title: run.result.draft.title,
        description: run.result.draft.description,
        acceptanceCriteria: run.result.draft.acceptanceCriteria,
        assumptions: run.result.draft.assumptions,
        openQuestions: run.result.draft.openQuestions,
      })
    : JSON.stringify({
        summary: run.result.report.summary,
        findings: run.result.report.findings,
        proposedTicket: run.result.report.proposedTicket,
      });

export const bannedSubstrings = (c: LoadedCase, run: CaseRun): string[] => {
  const text = outputText(run).toLowerCase();
  return c.expected.mustNotContain.filter((banned) => text.includes(banned.toLowerCase()));
};

export const claimsOf = (run: CaseRun) =>
  run.kind === "create"
    ? [...run.result.draft.description, ...run.result.draft.acceptanceCriteria]
    : [
        ...run.result.report.findings,
        ...run.result.report.proposedTicket.description,
        ...run.result.report.proposedTicket.acceptanceCriteria,
      ];

const evidenceOf = (run: CaseRun): Evidence[] =>
  run.kind === "create" ? run.result.draft.evidence : run.result.report.evidence;

const citedReferences = (run: CaseRun): Set<string> => {
  const citedIds = new Set(claimsOf(run).flatMap((claim) => claim.evidenceIds));
  return new Set(
    evidenceOf(run)
      .filter((item) => citedIds.has(item.id))
      .map((item) => item.reference),
  );
};

// A file in `relevantFiles` is established only when a claim cites it: reading it is not the same as using it.
export const uncitedRelevantFiles = (c: LoadedCase, run: CaseRun): string[] => {
  const cited = citedReferences(run);
  return c.expected.relevantFiles.filter((file) => !cited.has(file.replace(/^repo\//, "")));
};

async function runCase(
  c: LoadedCase,
  source: GitSource,
  generator: AiGenerator,
  selector: AiEvidenceAgent,
): Promise<CaseRun> {
  const tracker = trackerOf(c);
  if (c.kind === "audit") {
    if (!c.issue) throw new Error(`fixture ${c.id} is an audit case without an issue`);
    const result = await auditIssue({
      issueKey: c.issue.key,
      source,
      tracker,
      generator,
      selector,
    });
    return { kind: "audit", result, text: auditText(result.report) };
  }
  const result = await draftTicket({
    request: requestOf(c),
    answers: c.answers,
    source,
    tracker,
    generator,
    selector,
  });
  return { kind: "create", result, text: JSON.stringify(result.draft, null, 2) };
}

// Drafts a fixture with the current pipeline and writes results/<case>.json, which the blind review export reads.
export async function draftCase(c: LoadedCase): Promise<CaseRun & CaseMetrics> {
  const startedAt = Date.now();
  const run = await runCase(
    c,
    await sourceOf(c),
    new AiGenerator(getEnv().AI_MODEL),
    new AiEvidenceAgent(getEnv().AI_MODEL),
  );
  const latencyMs = Date.now() - startedAt;

  const retrieved = new Set(run.result.candidates.map((e) => `repo/${e.reference}`));
  const retrievalRecall =
    c.expected.relevantFiles.filter((f) => retrieved.has(f)).length / c.expected.relevantFiles.length;
  const output = run.kind === "create" ? run.result.draft : run.result.report;

  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(
    resultPath(c.id),
    JSON.stringify(
      {
        model: getEnv().AI_MODEL,
        kind: c.kind,
        latencyMs,
        retrievalRecall,
        usage: run.result.usage,
        issues: run.result.issues,
        expected: c.expected,
        output,
      },
      null,
      2,
    ),
  );
  return { ...run, latencyMs, retrievalRecall };
}

// The verdict is appended to the same file so a reader can see why a case passed or failed.
export function recordVerdict(c: LoadedCase, verdict: Verdict): void {
  const file = resultPath(c.id);
  const record = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  writeFileSync(file, JSON.stringify({ ...record, verdict }, null, 2));
}
