import { deu, fra, ita, nld, por, spa } from "stopword";

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

// Requests name UI parts loosely ("banner" for a hero section); code names them one way. The tracker search uses
// these terms too, so a request and a like issue meet on the same word.
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

// Terms are compared without case or accents ("créer" meets "creer"); anything matched against them is folded alike.
export const foldText = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const normalize = (text: string) => foldText(text.replace(QUOTED_LITERAL, " "));

// Function words of the common request languages: they match nearly every issue or file by substring.
const OTHER_LANGUAGE_STOPWORDS = new Set([...fra, ...spa, ...deu, ...ita, ...por, ...nld]);

// The words a tracker search uses to find related issues.
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
