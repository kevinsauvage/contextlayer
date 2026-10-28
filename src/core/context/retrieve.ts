import type { Evidence, EvidenceKind } from "@/core/evidence/schemas";
import type { ContextSource } from "@/core/context/source";

export type EvidenceCandidate = Omit<Evidence, "id">;

// Enough of a file for a draft to describe the change, without sending a 2,000-line file to the model. A selection
// spends the total budget; a file that needs more than its share gets the leftover, so one long config can still
// arrive whole.
const BASE_FILE_EXCERPT_CHARS = 8000;
const MAX_FILE_EXCERPT_CHARS = 24_000;
const TOTAL_EXCERPT_CHARS = 60_000;
const WINDOW_LEAD = 5;
const OMITTED = "\n… (middle of the file omitted) …\n";

function classifyKind(path: string): EvidenceKind {
  const lower = path.toLowerCase();
  if (/(^|\/)(adr|decisions?)\//.test(lower)) return "decision";
  if (lower.endsWith(".md") || lower.endsWith(".mdx")) return "documentation";
  return "code";
}

// Each file starts with an equal share of the budget; whatever a short file leaves unspent tops up the long ones,
// in selection order, since the agent lists the most important file first.
function excerptAllowances(lengths: number[]): number[] {
  const allowances = lengths.map((length) => Math.min(length, BASE_FILE_EXCERPT_CHARS));
  let remaining = TOTAL_EXCERPT_CHARS - allowances.reduce((total, value) => total + value, 0);
  for (let index = 0; index < lengths.length && remaining > 0; index += 1) {
    const length = lengths[index] ?? 0;
    const allowance = allowances[index] ?? 0;
    const extra = Math.min(Math.min(length, MAX_FILE_EXCERPT_CHARS) - allowance, remaining);
    if (extra <= 0) continue;
    allowances[index] = allowance + extra;
    remaining -= extra;
  }
  return allowances;
}

// A file that fits arrives whole; a longer one arrives as its head and its tail, because the values a config
// declares usually sit at the end, after the types and comments.
function excerptFrom(content: string, terms: string[], allowance: number) {
  const lines = content.split("\n");
  if (content.length <= allowance) {
    return { text: content.trim(), lines: { start: 1, end: Math.max(lines.length, 1) } };
  }
  const firstHit = lines.findIndex((line) => terms.some((term) => line.toLowerCase().includes(term)));
  const start = firstHit > WINDOW_LEAD ? firstHit - WINDOW_LEAD : 0;
  const startChar = lines.slice(0, start).reduce((total, line) => total + line.length + 1, 0);
  const half = Math.floor(allowance / 2);
  const head = content.slice(startChar, startChar + half).trim();
  const tail = content.slice(-half).trim();
  const text = startChar + half >= content.length - half ? content.slice(startChar).trim() : `${head}${OMITTED}${tail}`;
  return { text, lines: { start: start + 1, end: Math.max(lines.length, 1) } };
}

// Builds evidence from the files the agent named: the excerpt is cut from the real file, so the draft can cite it
// and a selection can never invent a source.
export async function evidenceFromPaths(
  paths: string[],
  terms: string[],
  source: ContextSource,
): Promise<EvidenceCandidate[]> {
  const files = [...new Set(paths)];
  const read = await Promise.all(
    files.map((path) =>
      source.readFile(path).then(
        (content) => ({ path, content }),
        () => null,
      ),
    ),
  );
  const found = read.filter(
    (file): file is { path: string; content: string } => file !== null && file.content.length > 0,
  );
  const allowances = excerptAllowances(found.map((file) => file.content.length));
  return found.map(({ path, content }, index) => {
    const excerpt = excerptFrom(content, terms, allowances[index] ?? BASE_FILE_EXCERPT_CHARS);
    return {
      kind: classifyKind(path),
      reference: path,
      url: source.urlFor?.(path, excerpt.lines),
      lines: excerpt.lines,
      excerpt: excerpt.text || path,
    };
  });
}
