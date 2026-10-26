import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { auditIssue, draftTicket, type AuditResult, type CreationResult } from "@/core/analysis/analyze";
import { AiGenerator } from "@/integrations/ai/generator";
import { DirectorySource } from "@/integrations/filesystem/directory-source";
import { getEnv } from "@/infrastructure/env";
import { requestOf, trackerOf, type LoadedCase } from "./fixtures";

export const RESULTS_DIR = path.join(import.meta.dirname, "results");

const resultPath = (id: string) => path.join(RESULTS_DIR, `${id}.json`);

type CaseRun =
  // `text` is what a judge reads: the draft for a ticket, or the report for an audit.
  { kind: "create"; result: CreationResult; text: string } | { kind: "audit"; result: AuditResult; text: string };

type CaseMetrics = { latencyMs: number; retrievalRecall: number };

export type Verdict = {
  pass: boolean;
  forbiddenClaims: string[];
  uncertainMarkedVerified: string[];
  rationale: string;
};

const auditText = (report: AuditResult["report"]) =>
  JSON.stringify(
    { summary: report.summary, findings: report.findings, proposedTicket: report.proposedTicket },
    null,
    2,
  );

async function runCase(c: LoadedCase, source: DirectorySource, generator: AiGenerator): Promise<CaseRun> {
  const tracker = trackerOf(c);
  if (c.kind === "audit") {
    if (!c.issue) throw new Error(`fixture ${c.id} is an audit case without an issue`);
    const result = await auditIssue({ issueKey: c.issue.key, source, tracker, generator, expander: generator });
    return { kind: "audit", result, text: auditText(result.report) };
  }
  const result = await draftTicket({
    request: requestOf(c),
    answers: c.answers,
    source,
    tracker,
    generator,
    expander: generator,
  });
  return { kind: "create", result, text: JSON.stringify(result.draft, null, 2) };
}

// Drafts a fixture with the current pipeline and writes results/<case>.json, which the blind review export reads.
export async function draftCase(c: LoadedCase): Promise<CaseRun & CaseMetrics> {
  const startedAt = Date.now();
  const run = await runCase(c, new DirectorySource(c.repoDir), new AiGenerator(getEnv().AI_MODEL));
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
