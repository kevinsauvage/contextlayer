import { describe, expect, it } from "vitest";
import { analysisAnswers, analysisRequest, mergeAnswers } from "@/features/analysis/input";
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
    expect(analysisRequest({ title: "Old" })).toBe("Old");
    expect(analysisRequest({ request: "New", answers: [] })).toBe("New");
    expect(analysisAnswers({ request: "x" })).toEqual([]);
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
