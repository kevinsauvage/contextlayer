// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenQuestions } from "@/components/analysis/open-questions";
import { RefinementProvider, type Question } from "@/components/analysis/refinement-context";
import type { Clarification } from "@/core/requirements/schemas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(cleanup);

const questions: Question[] = [
  {
    question: "Which rounding mode?",
    impact: "Changes every total.",
    options: [
      { text: "Half up", recommended: true },
      { text: "Half even", recommended: false },
    ],
    recommendation: "Half up matches the invoices.",
  },
  { question: "Should refunds round too?", impact: "Changes refund totals." },
];

function Harness({
  refine = vi.fn(async () => ({})),
  canRefine = true,
  decided = [] as Clarification[],
  items = questions,
}: {
  refine?: (turn: unknown) => Promise<{ error?: string }>;
  canRefine?: boolean;
  decided?: Clarification[];
  items?: Question[];
}) {
  return (
    <RefinementProvider questions={items} canRefine={canRefine} refine={refine}>
      <OpenQuestions decided={decided} />
    </RefinementProvider>
  );
}

describe("OpenQuestions", () => {
  it("renders each question with its impact, options and recommendation", () => {
    render(<Harness />);

    expect(screen.getByRole("heading", { name: "Open questions" })).toBeTruthy();
    expect(screen.getByText("Which rounding mode?")).toBeTruthy();
    expect(screen.getByText(/Changes every total/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Half up/ })).toBeTruthy();
    expect(screen.getByText("Recommended")).toBeTruthy();
    expect(screen.getByText(/Half up matches the invoices/)).toBeTruthy();
    expect(screen.getByText("0 of 2 decided")).toBeTruthy();
  });

  it("lets an option answer the question and toggles off when clicked again", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const halfUp = screen.getByRole("button", { name: /Half up/ });
    await user.click(halfUp);
    expect(screen.getByLabelText<HTMLInputElement>("Answer: Which rounding mode?").value).toBe("Half up");
    expect(halfUp.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("1 of 2 decided")).toBeTruthy();

    await user.click(halfUp);
    expect(screen.getByLabelText<HTMLInputElement>("Answer: Which rounding mode?").value).toBe("");
    expect(screen.getByText("0 of 2 decided")).toBeTruthy();
  });

  it("keeps a question open, and can come back to answering it", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const firstQuestion = screen.getByRole("group", { name: /Which rounding mode/ });
    await user.click(within(firstQuestion).getByRole("button", { name: "Leave open" }));
    expect(screen.queryByLabelText("Answer: Which rounding mode?")).toBeNull();
    expect(screen.getByText("Left open")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Answer instead" }));
    expect(screen.getByLabelText("Answer: Which rounding mode?")).toBeTruthy();
  });

  it("sends every answer, leaving unanswered questions blank, and redrafts", async () => {
    const refine = vi.fn(async () => ({}));
    const user = userEvent.setup();
    render(<Harness refine={refine} />);

    await user.type(screen.getByLabelText("Answer: Which rounding mode?"), "  Half up  ");
    await user.type(screen.getByLabelText("Answer: Should refunds round too?"), "No");
    await user.click(screen.getByRole("button", { name: "Update draft with 2 answers" }));

    await waitFor(() =>
      expect(refine).toHaveBeenCalledWith({
        answers: [
          { question: "Which rounding mode?", answer: "Half up" },
          { question: "Should refunds round too?", answer: "No" },
        ],
        message: "",
      }),
    );
  });

  it("cannot send until at least one question is answered", async () => {
    const refine = vi.fn(async () => ({}));
    const user = userEvent.setup();
    render(<Harness refine={refine} />);

    const update = screen.getByRole<HTMLButtonElement>("button", { name: "Update draft" });
    expect(update.disabled).toBe(true);
    expect(screen.getByText("Answer at least one question to update the draft.")).toBeTruthy();

    await user.type(screen.getByLabelText("Answer: Which rounding mode?"), "Half up");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Update draft with 1 answer" }).disabled).toBe(false);
  });

  it("shows the redraft failure next to the questions", async () => {
    const refine = vi.fn(async () => ({ error: "The draft was regenerated; reload the page" }));
    const user = userEvent.setup();
    render(<Harness refine={refine} />);

    await user.type(screen.getByLabelText("Answer: Which rounding mode?"), "Half up");
    await user.click(screen.getByRole("button", { name: "Update draft with 1 answer" }));

    expect((await screen.findByRole("alert")).textContent).toBe("The draft was regenerated; reload the page");
  });

  it("lists the answers applied to earlier drafts", () => {
    render(
      <Harness
        items={[]}
        decided={[
          { question: "Which currency?", answer: "EUR" },
          { question: "Round on the server?", answer: "Yes" },
        ]}
      />,
    );

    expect(screen.getByText("Decided earlier (2)")).toBeTruthy();
    expect(screen.getByText("Which currency?")).toBeTruthy();
    expect(screen.getByText("EUR")).toBeTruthy();
    expect(screen.getByText("Nothing is waiting on a decision.")).toBeTruthy();
  });

  it("renders nothing without questions or earlier decisions", () => {
    const { container } = render(<Harness items={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("disables the controls when the analysis cannot be refined", () => {
    render(<Harness canRefine={false} />);

    expect(screen.getByLabelText<HTMLInputElement>("Answer: Which rounding mode?").disabled).toBe(true);
    expect(
      within(screen.getByRole("group", { name: /Which rounding mode/ })).getByRole<HTMLButtonElement>("button", {
        name: "Leave open",
      }).disabled,
    ).toBe(true);
  });
});
