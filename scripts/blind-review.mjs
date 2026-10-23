// Blind scoring packets for the baseline comparison (experiment E3).
//
//   node scripts/blind-review.mjs export   # results/*.baseline.json -> review/<case>.md + scores.json
//   node scripts/blind-review.mjs report   # review/scores.json -> docs/product/e3-blind-review.md
//
// Export re-renders packets from the last `pnpm eval` run and keeps an existing scores.json untouched.
// The case -> label mapping is written to tests/evaluation/results/blind-key.json: the reviewer must not open it.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const FIXTURES_DIR = path.join("tests", "fixtures");
const RESULTS_DIR = path.join("tests", "evaluation", "results");
const REVIEW_DIR = path.join("tests", "evaluation", "review");
const KEY_PATH = path.join(RESULTS_DIR, "blind-key.json");
const SCORES_PATH = path.join(REVIEW_DIR, "scores.json");
const REPORT_PATH = path.join("docs", "product", "e3-blind-review.md");

const ROLES = ["original", "baseline", "contextlayer"];
const LABELS = ["A", "B", "C"];
const ROLE_NAMES = { original: "Original", baseline: "Generic AI", contextlayer: "ContextLayer" };
const CRITERIA = [
  "factualCorrectness",
  "evidenceTraceability",
  "requirementFidelity",
  "actionability",
  "acceptanceCriteria",
  "uncertaintyHandling",
];

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const total = (scores) => CRITERIA.reduce((sum, criterion) => sum + scores[criterion], 0);

function caseIds() {
  return readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(FIXTURES_DIR, entry.name, "case.json")))
    .map((entry) => entry.name)
    .sort();
}

// Stable rotation so labels stay put across exports, without relying on Math.random.
function labelsFor(id) {
  const offset = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % ROLES.length;
  return Object.fromEntries(LABELS.map((label, index) => [label, ROLES[(index + offset) % ROLES.length]]));
}

const evidenceById = (evidence) => new Map((evidence ?? []).map((item) => [item.id, item]));

function renderClaim(claim, evidence) {
  const citations = (claim.evidenceIds ?? []).map((id) => {
    const item = evidence.get(id);
    const lines = item?.lines ? `:${item.lines.start}-${item.lines.end}` : "";
    return item ? `${item.reference}${lines}` : id;
  });
  return `- ${claim.text} _(${claim.status}${citations.length ? `; source: ${citations.join(", ")}` : "; no source"})_`;
}

function renderDraft(draft) {
  const evidence = evidenceById(draft.evidence);
  const lines = [
    `**${draft.title}**`,
    "",
    "#### Description",
    ...draft.description.map((c) => renderClaim(c, evidence)),
  ];

  if (draft.acceptanceCriteria.length) {
    lines.push("", "#### Acceptance criteria");
    for (const criterion of draft.acceptanceCriteria) {
      const flag = criterion.requiresProductDecision ? " **[needs a product decision]**" : "";
      lines.push(renderClaim(criterion, evidence) + flag);
    }
  }

  if (draft.assumptions.length) {
    lines.push("", "#### Assumptions");
    for (const assumption of draft.assumptions) lines.push(`- ${assumption.text} — ${assumption.rationale}`);
  }

  if (draft.openQuestions.length) {
    lines.push("", "#### Open questions");
    for (const question of draft.openQuestions) lines.push(`- ${question.question} — ${question.impact}`);
  }

  if (evidence.size) {
    lines.push("", "#### Cited evidence");
    for (const item of evidence.values()) {
      const lines_ = item.lines ? `:${item.lines.start}-${item.lines.end}` : "";
      lines.push(`- \`${item.id}\` ${item.reference}${lines_} — "${item.excerpt}"`);
    }
  }

  return lines.join("\n");
}

function renderPacket(id, request, drafts) {
  const sections = LABELS.map((label) => `## Draft ${label}\n\n${drafts[label]}`).join("\n\n---\n\n");
  return [
    `# Blind review: ${id}`,
    "",
    `Request: "${request}"`,
    "",
    `Rubric: \`docs/product/evaluation-rubric.md\`. Score 0-2 per criterion for each draft.`,
    `Repository: read the files under \`${FIXTURES_DIR}/${id}/repo\`; ground truth is in \`${FIXTURES_DIR}/${id}/case.json\`, after scoring.`,
    `Do not open \`${KEY_PATH}\` before scoring.`,
    "",
    "---",
    "",
    sections,
    "",
  ].join("\n");
}

function scoreTemplate() {
  return Object.fromEntries(
    LABELS.map((label) => [
      label,
      { ...Object.fromEntries(CRITERIA.map((criterion) => [criterion, null])), wrongClaims: [] },
    ]),
  );
}

function exportPackets() {
  mkdirSync(REVIEW_DIR, { recursive: true });
  const key = {};
  const scores = existsSync(SCORES_PATH) ? readJson(SCORES_PATH) : { reviewer: null, preferred: {}, scores: {} };
  scores.scores ??= {};
  scores.preferred ??= {};

  for (const id of caseIds()) {
    const analysisPath = path.join(RESULTS_DIR, `${id}.json`);
    const baselinePath = path.join(RESULTS_DIR, `${id}.baseline.json`);
    if (!existsSync(analysisPath) || !existsSync(baselinePath))
      throw new Error(`Missing ${id} results. Run: pnpm eval`);

    const analysis = readJson(analysisPath);
    const comparison = readJson(baselinePath);
    const { title: request } = readJson(path.join(FIXTURES_DIR, id, "case.json"));

    key[id] = labelsFor(id);
    const byRole = {
      original: request,
      baseline: comparison.baseline.text,
      contextlayer: renderDraft(analysis.draft),
    };
    const drafts = Object.fromEntries(LABELS.map((label) => [label, byRole[key[id][label]]]));
    writeFileSync(path.join(REVIEW_DIR, `${id}.md`), renderPacket(id, request, drafts));

    scores.scores[id] ??= scoreTemplate();
    for (const label of LABELS) scores.scores[id][label].wrongClaims ??= [];
    if (!(id in scores.preferred)) scores.preferred[id] = null;
  }

  writeFileSync(KEY_PATH, JSON.stringify(key, null, 2));
  writeFileSync(SCORES_PATH, JSON.stringify(scores, null, 2));
  writeFileSync(
    path.join(REVIEW_DIR, "README.md"),
    [
      "# Blind review packets",
      "",
      "Generated by `node scripts/blind-review.mjs export`; do not edit the packets.",
      "",
      "1. Read `docs/product/evaluation-rubric.md`.",
      "2. For each `<case>.md`, read the case repository, score drafts A-C 0-2 per criterion in `scores.json`,",
      "   add any claim you believe is wrong to that draft's `wrongClaims`, and pick the draft you would start work from.",
      "3. Keep labels hidden: `tests/evaluation/results/blind-key.json` maps them to their source.",
      "4. Run `node scripts/blind-review.mjs report` to write `docs/product/e3-blind-review.md`.",
      "",
      "A new `pnpm eval` run changes the drafts: delete `scores.json` and score again.",
      "",
    ].join("\n"),
  );

  console.log(`Wrote ${caseIds().length} packets to ${REVIEW_DIR} and score template ${SCORES_PATH}.`);
}

function loadReview() {
  if (!existsSync(SCORES_PATH) || !existsSync(KEY_PATH))
    throw new Error("Run `node scripts/blind-review.mjs export` first.");
  return { key: readJson(KEY_PATH), scores: readJson(SCORES_PATH) };
}

function validate({ key, scores }) {
  const problems = [];
  if (!scores.reviewer) problems.push("scores.reviewer is empty");

  for (const id of Object.keys(key)) {
    const entry = scores.scores?.[id];
    if (!entry) {
      problems.push(`${id}: no scores`);
      continue;
    }
    for (const label of LABELS) {
      const missing = CRITERIA.filter((criterion) => {
        const value = entry[label]?.[criterion];
        return !Number.isInteger(value) || value < 0 || value > 2;
      });
      if (missing.length) problems.push(`${id} ${label}: ${missing.join(", ")}`);

      const wrongClaims = entry[label]?.wrongClaims;
      if (
        wrongClaims !== undefined &&
        (!Array.isArray(wrongClaims) || wrongClaims.some((c) => typeof c !== "string"))
      ) {
        problems.push(`${id} ${label}: wrongClaims must be an array of strings`);
      }
    }
    if (!LABELS.includes(scores.preferred?.[id])) problems.push(`${id}: preferred must be one of ${LABELS.join(", ")}`);
  }

  return problems;
}

function summarize({ key, scores }) {
  const rows = Object.keys(key).map((id) => {
    const judgment = readJson(path.join(RESULTS_DIR, `${id}.baseline.json`)).judgment;
    const labels = key[id];
    const labelOf = (role) => LABELS.find((label) => labels[label] === role);
    const perRole = Object.fromEntries(
      ROLES.map((role) => [
        role,
        { human: total(scores.scores[id][labelOf(role)]), judge: total(judgment[role]), label: labelOf(role) },
      ]),
    );
    const best = Math.max(...ROLES.map((role) => perRole[role].human));

    return {
      id,
      perRole,
      winners: ROLES.filter((role) => perRole[role].human === best),
      preferred: labels[scores.preferred[id]],
    };
  });

  const { judgeModel, judgeIsGenerator, model } = readJson(path.join(RESULTS_DIR, `${rows[0].id}.baseline.json`));
  return { rows, model, judgeModel: judgeModel ?? model, judgeIsGenerator: Boolean(judgeIsGenerator) };
}

function renderReport(scores, { rows, model, judgeModel, judgeIsGenerator }) {
  const wins = Object.fromEntries(ROLES.map((role) => [role, rows.filter((row) => row.winners.includes(role)).length]));
  const preferred = Object.fromEntries(
    ROLES.map((role) => [role, rows.filter((row) => row.preferred === role).length]),
  );

  const caseTable = [
    "| Case | Original | Generic AI | ContextLayer | Human pick |",
    "| ---- | -------- | ---------- | ------------ | ---------- |",
    ...rows.map(
      (row) =>
        `| ${row.id} | ${row.perRole.original.human} | ${row.perRole.baseline.human} | ${row.perRole.contextlayer.human} | ${row.preferred} |`,
    ),
  ].join("\n");

  const judgeTable = [
    "| Case | Original | Generic AI | ContextLayer |",
    "| ---- | -------- | ---------- | ------------ |",
    ...rows.map(
      (row) =>
        `| ${row.id} | ${row.perRole.original.judge} | ${row.perRole.baseline.judge} | ${row.perRole.contextlayer.judge} |`,
    ),
  ].join("\n");

  const detail = rows
    .flatMap((row) =>
      ROLES.map((role) => {
        const draftScores = scores.scores[row.id][row.perRole[role].label];
        return `| ${row.id} | ${row.perRole[role].label} | ${ROLE_NAMES[role]} | ${CRITERIA.map((c) => draftScores[c]).join(" | ")} | ${total(draftScores)} |`;
      }),
    )
    .join("\n");

  const wrongClaims = rows.flatMap((row) =>
    ROLES.flatMap((role) =>
      (scores.scores[row.id][row.perRole[role].label].wrongClaims ?? []).map(
        (claim) => `- ${row.id} / ${ROLE_NAMES[role]}: ${claim}`,
      ),
    ),
  );
  const draftsWithWrongClaims = rows.flatMap((row) =>
    ROLES.filter((role) => (scores.scores[row.id][row.perRole[role].label].wrongClaims ?? []).length > 0),
  ).length;

  return [
    "# E3: blind human scoring",
    "",
    `Reviewer: ${scores.reviewer}`,
    "",
    "Drafts exported by `node scripts/blind-review.mjs export` from the last `pnpm eval` run and scored blind; the labels were revealed by the report script.",
    "",
    "## Totals (max 12)",
    "",
    caseTable,
    "",
    `Cases won or tied: Original ${wins.original}, Generic AI ${wins.baseline}, ContextLayer ${wins.contextlayer}. Human pick: Original ${preferred.original}, Generic AI ${preferred.baseline}, ContextLayer ${preferred.contextlayer}.`,
    "",
    `Wrong claims marked: ${wrongClaims.length} across ${draftsWithWrongClaims} of ${rows.length * ROLES.length} drafts. E3 allows at most one per ten drafts.`,
    "",
    wrongClaims.length ? ["## Wrong claims", "", ...wrongClaims, ""].join("\n") : "",
    "",
    "## Against the LLM judge",
    "",
    `Generated by \`${model}\`; judged by \`${judgeModel}\`${judgeIsGenerator ? ", the generating model, so those scores are biased" : ""}.`,
    "",
    judgeTable,
    "",
    "## Per criterion",
    "",
    `| Case | Label | Source | ${CRITERIA.join(" | ")} | Total |`,
    `| ---- | ----- | ------ | ${CRITERIA.map(() => "---").join(" | ")} | ----- |`,
    detail,
    "",
    "## Limits",
    "",
    "- Four fixtures and one reviewer: directional evidence, not E3. E3 asks for ten tickets and three independent reviewers.",
    "- The reviewer read miniature repositories, not code they own; wrong-claim detection is weaker than with familiar code.",
    "- Human scores override the judge; where they disagree, the judge prompt or the rubric is ambiguous and needs tightening.",
    "",
  ].join("\n");
}

function reportScores() {
  const review = loadReview();
  const problems = validate(review);
  if (problems.length) {
    console.error(`Cannot report yet:\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }

  mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, renderReport(review.scores, summarize(review)));
  console.log(`Wrote ${REPORT_PATH}.`);
}

const command = process.argv[2];
if (command === "export") exportPackets();
else if (command === "report") reportScores();
else {
  console.error("Usage: node scripts/blind-review.mjs <export|report>");
  process.exit(1);
}
