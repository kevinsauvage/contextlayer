import { describe, expect, it } from "vitest";
import { matchesQuestion, questionOverlap } from "../evaluation/questions";

describe("matching re-asked questions", () => {
  it("recognises the same question reworded", () => {
    expect(
      matchesQuestion(
        "Should saved filters be private to each user or shared with the whole team?",
        "Are saved filters personal, or shared with the team?",
      ),
    ).toBe(true);
  });

  it("keeps a different question about the same feature apart", () => {
    expect(
      matchesQuestion("Where should the saved filters appear in the reports UI?", "How many filter sets can be saved?"),
    ).toBe(false);
  });

  it("recognises a French question reworded, accents and all", () => {
    expect(
      matchesQuestion(
        "La copie doit-elle garder la date d'échéance d'origine ?",
        "Faut-il conserver l'échéance d'origine sur la copie ?",
      ),
    ).toBe(true);
  });

  it("keeps two French questions about the same feature apart", () => {
    expect(
      matchesQuestion(
        "La copie doit-elle garder la date d'échéance d'origine ?",
        "Peut-on dupliquer une facture annulée ?",
      ),
    ).toBe(false);
  });

  it("reports no overlap for empty text", () => {
    expect(questionOverlap("", "anything")).toBe(0);
  });
});
