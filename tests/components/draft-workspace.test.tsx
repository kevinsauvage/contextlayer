// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DraftWorkspace } from "@/components/analysis/draft-workspace";
import type { Evidence } from "@/core/evidence/schemas";
import type { EvidenceIssue } from "@/core/evidence/validate";
import type { TicketDraft } from "@/core/requirements/schemas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(cleanup);

const ready: TicketDraft = {
  title: "Round cart totals",
  description: [{ text: "Totals are rounded down.", status: "verified", evidenceIds: ["e1"] }],
  acceptanceCriteria: [],
  assumptions: [],
  openQuestions: [],
  evidence: [{ id: "e1", kind: "code", reference: "src/cart/loadCart.ts", excerpt: "Math.floor(total)" }],
};

const withQuestion: TicketDraft = {
  ...ready,
  openQuestions: [{ question: "Round half up or half even?", impact: "Changes totals" }],
};

type RenderOptions = {
  save?: (draft: TicketDraft) => Promise<object>;
  issues?: EvidenceIssue[];
  evidence?: Evidence[];
};

function renderWorkspace(initial: TicketDraft, options: RenderOptions = {}) {
  const publish = vi.fn(async () => ({ issueKey: "SHOP-1", issueUrl: "https://jira.test/browse/SHOP-1" }));
  render(
    <DraftWorkspace
      initial={initial}
      publish={publish}
      publishLabel="Approve and create"
      trackerName="Jira"
      projectLabel="SHOP"
      save={options.save}
      issues={options.issues}
      evidence={options.evidence}
      published={{ key: null, url: null }}
    />,
  );
  return { publish, user: userEvent.setup() };
}

async function editTitle(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(screen.getByRole("tab", { name: "Edit" }));
  const input = screen.getByLabelText(/title/i);
  await user.clear(input);
  await user.type(input, title);
}

describe("DraftWorkspace", () => {
  it("checks the draft against its evidence as it is edited", async () => {
    const misquoted: TicketDraft = {
      ...ready,
      description: [{ text: "Totals use `Math.round`.", status: "verified", evidenceIds: ["e1"] }],
    };
    const { user } = renderWorkspace(misquoted, { evidence: ready.evidence });

    expect(screen.getByText(/quotes "math.round", which its cited evidence does not contain/)).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: "Edit" }));
    const paragraph = screen
      .getAllByRole("textbox")
      .find((element) => element.getAttribute("aria-label") === "Description paragraph 1");
    if (!paragraph) throw new Error("no description field");
    await user.clear(paragraph);
    await user.type(paragraph, "Totals are rounded down.");

    expect(screen.queryByText(/quotes "math.round"/)).toBeNull();
  });

  it("blocks approval while a claim does not match its evidence", async () => {
    const misquoted: TicketDraft = {
      ...ready,
      description: [{ text: "Totals use `Math.round`.", status: "verified", evidenceIds: ["e1"] }],
    };
    const { publish, user } = renderWorkspace(misquoted, { evidence: ready.evidence });

    expect(screen.getByText("Claims don't match their evidence")).toBeTruthy();
    const approve = screen.getByRole("button", { name: "Approve and create" });
    expect(approve.hasAttribute("disabled")).toBe(true);
    await user.click(approve);
    expect(publish).not.toHaveBeenCalled();
  });

  it("checks a reloaded draft against its evidence even when this tab did not edit it", () => {
    const misquoted: TicketDraft = {
      ...ready,
      description: [{ text: "Totals use `Math.round`.", status: "verified", evidenceIds: ["e1"] }],
    };
    renderWorkspace(misquoted, { issues: [], evidence: ready.evidence });

    expect(screen.getByText(/quotes "math.round"/)).toBeTruthy();
  });

  it("lets an open-question conflict be published anyway", async () => {
    const deciding: TicketDraft = {
      ...ready,
      description: [{ text: "Reject with 429.", status: "inferred", evidenceIds: [] }],
      openQuestions: [
        {
          question: "Which code?",
          impact: "Changes the contract",
          options: [{ text: "429 Too Many Requests", recommended: false }],
        },
      ],
    };
    const { publish, user } = renderWorkspace(deciding, { evidence: ready.evidence });

    expect(screen.getByText("Claims decide an open question")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Approve and create" }));
    const confirmation = screen
      .getAllByRole("alert")
      .find((element) => element.textContent.includes("Still unresolved"));
    expect(confirmation?.textContent).toContain("claim decides an open question");
    await user.click(screen.getByRole("button", { name: "Publish anyway" }));
    expect(publish).toHaveBeenCalledWith(deciding);
  });

  it("keeps the run's finding issues when it re-checks the claims", () => {
    const finding = { path: "findings[0]", message: "A finding issue from the run.", kind: "evidence" as const };
    renderWorkspace(ready, { issues: [finding], evidence: ready.evidence });

    expect(screen.getByText("A finding issue from the run.")).toBeTruthy();
  });

  it("publishes a ready draft on the first click and shows where it landed", async () => {
    const { publish, user } = renderWorkspace(ready);

    expect(screen.getByText("Nothing left to decide")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Approve and create" }));

    expect(publish).toHaveBeenCalledWith(ready);
    expect(await screen.findByText("Created SHOP-1 in Jira")).toBeTruthy();
  });

  it("asks for confirmation before publishing a draft with unresolved items", async () => {
    const { publish, user } = renderWorkspace(withQuestion);

    await user.click(screen.getByRole("button", { name: "Approve and create" }));
    expect(screen.getByRole("alert").textContent).toContain("Still unresolved: 1 open question");
    expect(publish).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(publish).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Approve and create" }));
    await user.click(screen.getByRole("button", { name: "Publish anyway" }));
    expect(publish).toHaveBeenCalledWith(withQuestion);
  });

  it("autosaves an edit once typing pauses, and publishes the edited draft", async () => {
    const save = vi.fn(async () => ({}));
    const { publish, user } = renderWorkspace(ready, { save });

    await editTitle(user, "Round cart totals half up");
    expect(save).not.toHaveBeenCalled();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(save).toHaveBeenCalledWith({ ...ready, title: "Round cart totals half up" });

    await user.click(screen.getByRole("button", { name: "Approve and create" }));
    expect(publish).toHaveBeenCalledWith({ ...ready, title: "Round cart totals half up" });
  });

  it("shows when an autosave failed, and keeps only finished items in what it sends", async () => {
    const save = vi.fn(async () => ({ error: "The draft was regenerated; reload the page" }));
    const { user } = renderWorkspace(ready, { save });

    await user.click(screen.getByRole("tab", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Add criterion" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1), { timeout: 2000 });

    expect(save).toHaveBeenCalledWith(ready);
    expect((await screen.findByRole("status")).textContent).toContain("Not saved: The draft was regenerated");
  });

  it("warns before leaving the page only while there are unsaved edits", async () => {
    const { user } = renderWorkspace(ready);
    const leave = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };

    expect(leave()).toBe(false);
    await editTitle(user, "Round cart totals half up");
    expect(leave()).toBe(true);
  });
});
