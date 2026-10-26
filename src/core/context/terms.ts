import { deu, fra, ita, nld, por, spa } from "stopword";

// A term found in a file path says more about relevance than one found in its content.
export const PATH_WEIGHT = 3;

const MAX_TERMS = 10;

// Instruction words that carry no meaning in a code search.
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
  "current",
  "line",
  "find",
  "other",
  "site",
  "website",
  "too",
  "very",
  "really",
  "annoying",
  "nice",
  "good",
  "bad",
  "better",
  "worse",
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
  dark: ["theme", "scheme", "color"],
  light: ["theme", "scheme"],
  theme: ["color", "tokens"],
  font: ["typography"],
  animation: ["motion", "transition"],
  mobile: ["responsive", "viewport"],
  slow: ["performance", "latency"],
  fast: ["performance"],
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

// Content is long, so repeated mentions say more than a single class name; cap each term so one word cannot dominate.
const MAX_TERM_OCCURRENCES = 5;
export const scoreMatches = (text: string, terms: string[]) =>
  terms.reduce((total, term) => total + Math.min(text.split(term).length - 1, MAX_TERM_OCCURRENCES), 0);

// Expanded terms are interleaved with the request's own terms, which come first: code search only runs on the
// first few terms, so appending would leave the model's terms unsearched. Scoring ignores the order.
const MAX_EXPANDED_TERMS = 8;
const MAX_TERM_LENGTH = 48;

export function mergeTerms(primary: string[], expanded: string[]): string[] {
  const seen = new Set(primary);
  const extra: string[] = [];
  for (const raw of expanded) {
    const term = raw
      .trim()
      .toLowerCase()
      .replace(/^[`"']+|[`"']+$/g, "");
    const usable = term.length > 1 && term.length <= MAX_TERM_LENGTH && !/\s/.test(term) && !seen.has(term);
    if (!usable) continue;
    seen.add(term);
    extra.push(term);
    if (extra.length === MAX_EXPANDED_TERMS) break;
  }
  const length = Math.max(primary.length, extra.length);
  return Array.from({ length }, (_, i) => [primary[i], extra[i]])
    .flat()
    .filter((term) => term !== undefined);
}

// Function words of the common request languages: they match nearly every file by substring.
const OTHER_LANGUAGE_STOPWORDS = new Set([...fra, ...spa, ...deu, ...ita, ...por, ...nld]);

export function extractTerms(text: string, max = MAX_TERMS): string[] {
  const frequency = new Map<string, number>();
  for (const term of normalize(text).split(/[^a-z0-9]+/)) {
    if (term.length > 2 && !STOPWORDS.has(term) && !OTHER_LANGUAGE_STOPWORDS.has(term))
      frequency.set(term, (frequency.get(term) ?? 0) + 1);
  }
  const primary = [...frequency]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([term]) => term);
  return [...new Set([...primary, ...primary.flatMap((term) => SYNONYMS[term] ?? [])])];
}
