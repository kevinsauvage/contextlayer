import { describe, expect, it } from "vitest";
import { answersOf, mergeAnswers, readAnalysisInput, requestOf } from "@/features/analysis/input";
import { buildCreatePrompt } from "@/integrations/ai/prompt";

describe("merging answers across rounds", () => {
  const previous = [
    { question: "Which banner?", answer: "The home hero" },
    { question: "One line or two?", answer: "" },
  ];

  it("keeps earlier answers, drops earlier unanswered questions, and adds this round", () => {
    const round = [{ question: "Keep the gradient?", answer: "Yes" }];
    expect(mergeAnswers(previous, round)).toEqual([previous[0], ...round]);
  });

  it("lets a later answer replace an earlier one", () => {
    const round = [{ question: "Which banner?", answer: "The cookie banner" }];
    expect(mergeAnswers(previous, round)).toEqual(round);
  });
});

describe("analysis input", () => {
  it("reads requests stored before the rename as title", () => {
    expect(requestOf(readAnalysisInput({ kind: "create", input: { title: "Old" } }))).toBe("Old");
    expect(requestOf(readAnalysisInput({ kind: "create", input: { request: "New", answers: [] } }))).toBe("New");
    expect(answersOf(readAnalysisInput({ kind: "create", input: { request: "x" } }))).toEqual([]);
  });

  it("tags an audit input with its kind and rejects a create payload", () => {
    expect(readAnalysisInput({ kind: "audit", input: { issueKey: "KAN-4" } })).toEqual({
      kind: "audit",
      issueKey: "KAN-4",
    });
    expect(readAnalysisInput({ kind: "audit", input: { title: "Old" } })).toBeNull();
  });
});

describe("create prompt", () => {
  it("passes answers and marks unanswered questions as open", () => {
    const prompt = buildCreatePrompt(
      "Change the banner title",
      [
        { question: "Which banner?", answer: "The home hero" },
        { question: "One line or two?", answer: "" },
      ],
      [],
    );
    expect(prompt).toContain("Q: Which banner?\nA: The home hero");
    expect(prompt).toContain("A: (no answer yet; keep this question open)");
    expect(buildCreatePrompt("x", [], [])).not.toContain("<answers>");
  });
});
