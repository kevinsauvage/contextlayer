// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TicketPreview } from "@/components/analysis/ticket-preview";
import type { TicketDraft } from "@/core/requirements/schemas";

afterEach(cleanup);

const draft: TicketDraft = {
  title: "Round cart totals",
  description: [
    { text: "Totals use `Math.floor`.", status: "verified", evidenceIds: ["e1"] },
    { text: "Rounding may need to change.", status: "needs_clarification", evidenceIds: [] },
  ],
  acceptanceCriteria: [
    { text: "Totals round half up.", status: "inferred", evidenceIds: [], requiresProductDecision: false },
  ],
  assumptions: [{ text: "Currency is EUR", rationale: "The shop is French" }],
  openQuestions: [{ question: "Round refunds too?", impact: "Changes refunds" }],
  evidence: [
    {
      id: "e1",
      kind: "code",
      reference: "src/cart/loadCart.ts",
      lines: { start: 3, end: 4 },
      url: "https://github.test/a/b/blob/abc/src/cart/loadCart.ts#L3-L4",
      excerpt: "Math.floor(total)",
    },
  ],
};

const renderPreview = (
  overrides: Partial<TicketDraft> = {},
  questionsAnchored = false,
  issueKey: string | null = null,
) =>
  render(
    <TicketPreview
      draft={{ ...draft, ...overrides }}
      trackerName="Jira"
      projectLabel="SHOP"
      issueKey={issueKey}
      statusLabel="Draft"
      questionsAnchored={questionsAnchored}
    />,
  );

describe("TicketPreview", () => {
  it("shows the project and new issue, the title, and the claim statuses", () => {
    renderPreview();

    expect(screen.getByRole("article", { name: "Jira preview" })).toBeTruthy();
    expect(screen.getByText("New issue")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Round cart totals" })).toBeTruthy();
    expect(screen.getByText("Verified:")).toBeTruthy();
    expect(screen.getAllByText("Needs clarification").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Inferred").length).toBeGreaterThan(0);
    expect(screen.getByText(/Totals round half up/)).toBeTruthy();
  });

  it("renders backticked identifiers as code", () => {
    renderPreview();
    expect(screen.getByText("Math.floor").tagName).toBe("CODE");
  });

  it("links a citation to its evidence and shows the excerpt", () => {
    renderPreview();

    const citation = screen.getByRole("link", { name: "Evidence e1: src/cart/loadCart.ts" });
    expect(citation.getAttribute("href")).toBe("#evidence-e1");
    expect(screen.getByText("src/cart/loadCart.ts:3-4").getAttribute("href")).toBe(
      "https://github.test/a/b/blob/abc/src/cart/loadCart.ts#L3-L4",
    );
    expect(screen.getByText("Math.floor(total)")).toBeTruthy();
  });

  it("marks a criterion that needs a product decision and links to the questions", () => {
    renderPreview(
      {
        acceptanceCriteria: [
          { text: "Totals round half up.", status: "inferred", evidenceIds: [], requiresProductDecision: true },
        ],
      },
      true,
    );

    expect(screen.getByText(/Totals round half up. \(needs product decision\)/)).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "See open questions" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Answer these below" }).getAttribute("href")).toBe("#open-questions");
  });

  it("summarizes the claim counts and the open questions", () => {
    renderPreview();

    const questions = screen.getAllByText("Open questions").find((element) => element.tagName === "DT");
    expect(questions?.parentElement?.querySelector("dd")?.textContent).toBe("1");
    const claims = screen.getByText("Claims").parentElement;
    expect(claims?.textContent).toContain("Verified");
    expect(claims?.textContent).toContain("Inferred");
    expect(claims?.textContent).toContain("Needs clarification");
  });

  it("shows an existing issue key for an audit", () => {
    renderPreview({}, false, "SHOP-12");
    expect(screen.getByText("SHOP-12")).toBeTruthy();
  });
});
