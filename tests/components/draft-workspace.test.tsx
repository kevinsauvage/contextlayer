// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DraftWorkspace } from "@/components/analysis/draft-workspace";
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

function renderWorkspace(initial: TicketDraft, options: { save?: (draft: TicketDraft) => Promise<object> } = {}) {
  const publish = vi.fn(async () => ({ issueKey: "SHOP-1", issueUrl: "https://jira.test/browse/SHOP-1" }));
  render(
    <DraftWorkspace
      initial={initial}
      publish={publish}
      publishLabel="Approve and create"
      trackerName="Jira"
      projectLabel="SHOP"
      save={options.save}
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
