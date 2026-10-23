// A term found in a file path says more about relevance than one found in its content.
export const PATH_WEIGHT = 3;

const MAX_TERMS = 10;

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "add",
  "new",
  "improve",
  "fix",
  "make",
  "from",
  "into",
  "page",
  "when",
  "that",
  "this",
  "should",
  "would",
  "could",
  "have",
  "has",
  "are",
  "was",
  "not",
  "can",
  "will",
  "all",
  "change",
  "update",
  "replace",
  "rename",
  "remove",
  "set",
  "show",
  "display",
]);

// Requests name UI parts loosely ("banner" for a hero section); code names them one way. Kept small and generic
// until LLM query expansion exists.
const SYNONYMS: Record<string, string[]> = {
  banner: ["hero", "header"],
  hero: ["banner"],
  title: ["heading", "headline"],
  heading: ["title"],
  headline: ["title", "heading"],
  popup: ["modal", "dialog"],
  modal: ["dialog", "popup"],
  dialog: ["modal"],
  login: ["signin", "auth"],
  signin: ["login", "auth"],
  signup: ["register"],
  navbar: ["nav", "navigation", "header"],
  menu: ["nav", "navigation"],
  footer: ["layout"],
};

// A quoted string in a request is usually the new value, which the code cannot contain yet.
const QUOTED_LITERAL = /"[^"]*"|“[^”]*”|`[^`]*`/g;

const normalize = (text: string) =>
  text
    .replace(QUOTED_LITERAL, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const countMatches = (text: string, terms: string[]) => terms.filter((term) => text.includes(term)).length;

export function extractTerms(text: string, max = MAX_TERMS): string[] {
  const frequency = new Map<string, number>();
  for (const term of normalize(text).split(/[^a-z0-9]+/)) {
    if (term.length > 2 && !STOPWORDS.has(term)) frequency.set(term, (frequency.get(term) ?? 0) + 1);
  }
  const primary = [...frequency]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([term]) => term);
  return [...new Set([...primary, ...primary.flatMap((term) => SYNONYMS[term] ?? [])])];
}
