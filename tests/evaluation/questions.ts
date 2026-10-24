const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "should",
  "what",
  "which",
  "when",
  "where",
  "have",
  "from",
  "into",
  "your",
  "their",
  "there",
  "about",
  "after",
  "before",
  "than",
  "then",
  "them",
  "they",
  "will",
  "would",
  "could",
  "does",
  "each",
  "only",
]);

const keyWords = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((word) => word.length > 3 && !STOPWORDS.has(word)),
  );

export function questionOverlap(left: string, right: string): number {
  const leftWords = keyWords(left);
  const rightWords = keyWords(right);
  const shared = [...leftWords].filter((word) => rightWords.has(word)).length;
  return shared / Math.max(leftWords.size, rightWords.size, 1);
}

// Question wording varies between drafts, so a shared-core match decides whether one question is the other re-asked.
export const matchesQuestion = (question: string, candidate: string) => questionOverlap(question, candidate) >= 0.5;
