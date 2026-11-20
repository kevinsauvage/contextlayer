// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ComponentProps } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { DraftEditor } from "@/components/analysis/draft-editor";
import type { TicketDraft } from "@/core/requirements/schemas";

afterEach(cleanup);

const draft: TicketDraft = {
  title: "Round cart totals",
  description: [{ text: "Totals use Math.floor.", status: "verified", evidenceIds: ["e1"] }],
  acceptanceCriteria: [
    { text: "Totals round half up.", status: "inferred", evidenceIds: [], requiresProductDecision: false },
  ],
  assumptions: [],
  openQuestions: [{ question: "Round refunds too?", impact: "Changes refunds" }],
  evidence: [
    {
      id: "e1",
      kind: "code",
      reference: "src/cart/loadCart.ts",
      url: "https://github.test/a/b/blob/abc/src/cart/loadCart.ts#L1-L2",
      excerpt: "Math.floor(total)",
    },
  ],
};

function Editor(props: Partial<ComponentProps<typeof DraftEditor>> = {}) {
  const [current, setCurrent] = useState(draft);
  return <DraftEditor draft={current} onChange={setCurrent} disabled={false} trackerName="Jira" {...props} />;
}

describe("DraftEditor", () => {
  it("edits the title", async () => {
    const user = userEvent.setup();
    render(<Editor />);

    const title = screen.getByLabelText<HTMLInputElement>("Title");
    await user.clear(title);
    await user.type(title, "Round totals");

    expect(title.value).toBe("Round totals");
  });

  it("makes an edited Verified claim Inferred and tells the reviewer", async () => {
    const user = userEvent.setup();
    render(<Editor />);

    const paragraph = screen.getByRole("textbox", { name: "Description paragraph 1" });
    expect(screen.getByText("Editing the text makes this claim Inferred.")).toBeTruthy();
    await user.type(paragraph, " Always.");

    expect(screen.getByRole<HTMLSelectElement>("combobox", { name: "Status of description paragraph 1" }).value).toBe(
      "inferred",
    );
  });

  it("changes the status of a claim explicitly", async () => {
    const user = userEvent.setup();
    render(<Editor />);

    const status = screen.getByRole("combobox", { name: "Status of description paragraph 1" });
    await user.selectOptions(status, "needs_clarification");

    expect((status as HTMLSelectElement).value).toBe("needs_clarification");
  });

  it("adds and removes acceptance criteria and description paragraphs", async () => {
    const user = userEvent.setup();
    render(<Editor />);

    await user.click(screen.getByRole("button", { name: "Add criterion" }));
    expect(screen.getByRole("textbox", { name: "Acceptance criterion 2" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Add paragraph" }));
    expect(screen.getByRole("textbox", { name: "Description paragraph 2" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Remove acceptance criterion 2" }));
    expect(screen.queryByRole("textbox", { name: "Acceptance criterion 2" })).toBeNull();
  });

  it("toggles the product-decision flag of a criterion", async () => {
    const user = userEvent.setup();
    render(<Editor />);

    const flag = screen.getByRole<HTMLInputElement>("checkbox", { name: "Needs product decision" });
    expect(flag.checked).toBe(false);
    await user.click(flag);

    expect(flag.checked).toBe(true);
  });

  it("shows cited evidence with its excerpt", () => {
    render(<Editor />);

    expect(screen.getByText("src/cart/loadCart.ts")).toBeTruthy();
    expect(screen.getByText("Math.floor(total)")).toBeTruthy();
    expect(screen.getByText("Evidence: e1")).toBeTruthy();
  });

  it("links to the open-questions block instead of editing questions there", () => {
    render(<Editor questionsAnchored />);

    expect(screen.queryByRole("textbox", { name: "Open question 1" })).toBeNull();
    expect(screen.getByRole("link", { name: "Open questions" }).getAttribute("href")).toBe("#open-questions");
  });

  it("edits open questions when they are not anchored", async () => {
    const user = userEvent.setup();
    render(<Editor />);

    const question = screen.getByRole<HTMLInputElement>("textbox", { name: "Open question 1" });
    await user.type(question, " For refunds?");

    expect(question.value).toContain("Round refunds too?");
  });

  it("disables every field on a published draft", () => {
    render(<Editor disabled />);

    expect(screen.getByLabelText<HTMLInputElement>("Title").disabled).toBe(true);
    expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Description paragraph 1" }).disabled).toBe(true);
  });
});
