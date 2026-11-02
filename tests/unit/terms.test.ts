import { describe, expect, it } from "vitest";
import { extractTerms, foldText } from "@/core/context/terms";

describe("extractTerms", () => {
  it("drops instruction words and appends synonyms after the request's own words", () => {
    expect(extractTerms("Change the banner title on the home page")).toEqual([
      "banner",
      "title",
      "home",
      "hero",
      "header",
      "heading",
      "headline",
    ]);
  });

  it("drops French function words and strips accents", () => {
    const terms = extractTerms("Ajouter un export CSV des commandes depuis la page de détail");
    expect(terms).toEqual(expect.arrayContaining(["export", "csv", "commandes", "detail"]));
    expect(terms).not.toContain("un");
    expect(terms).not.toContain("des");
    expect(terms).not.toContain("détail");
  });

  // A quoted value is what the request wants written; the code cannot contain it yet.
  it("ignores quoted literals", () => {
    expect(extractTerms('Replace "Welcome back" with “Hello” in the hero')).toEqual(["hero", "banner"]);
  });

  it("orders terms by how often the request uses them", () => {
    expect(extractTerms("price total cart cart cart total")).toEqual(["cart", "total", "price"]);
  });

  it("skips words of two letters or fewer", () => {
    expect(extractTerms("a an to of id ui")).toEqual([]);
  });

  it("caps the request's own words, before adding synonyms", () => {
    const words = "one two three four five six seven eight nine ten eleven twelve";
    expect(extractTerms(words)).toHaveLength(10);
    expect(extractTerms("banner banner modal title", 2)).toEqual([
      "banner",
      "modal",
      "hero",
      "header",
      "dialog",
      "popup",
    ]);
  });
});

describe("foldText", () => {
  it("lowercases and strips accents so terms and text compare alike", () => {
    expect(foldText("Créer l'Été")).toBe("creer l'ete");
  });
});
