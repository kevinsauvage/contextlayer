// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DraftWorkspace } from "@/components/analysis/draft-workspace";
import { RefinementProvider } from "@/components/analysis/refinement-context";
import { TicketChat } from "@/components/analysis/ticket-chat";
import type { TicketDraft } from "@/core/requirements/schemas";
import type { ChatTurn } from "@/features/ticket-creation/actions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(cleanup);

const draft: TicketDraft = {
  title: "Round cart totals",
  description: [{ text: "Totals are rounded down.", status: "inferred", evidenceIds: [] }],
  acceptanceCriteria: [],
  assumptions: [],
  openQuestions: [],
  evidence: [],
};

// The page's layout: the chat and the draft share one refinement round.
function renderPage() {
  // Never settles, so the chat stays in its "redrafting" state for the assertions.
  const refine = vi.fn((_turn: ChatTurn) => new Promise<{ error?: string }>(() => undefined));
  render(
    <RefinementProvider questions={[]} canRefine refine={refine}>
      <TicketChat
        request="Round the cart total"
        refinements={[]}
        status="completed"
        error={null}
        draftTitle={draft.title}
        publishedKey={null}
        publishedUrl={null}
        trackerName="Jira"
      />
      <DraftWorkspace
        initial={draft}
        publish={vi.fn()}
        publishLabel="Approve and create"
        trackerName="Jira"
        projectLabel="SHOP"
        published={{ key: null, url: null }}
      />
    </RefinementProvider>,
  );
  return { refine, user: userEvent.setup() };
}

describe("TicketChat", () => {
  it("sends a message on Enter and shows the redraft in progress", async () => {
    const { refine, user } = renderPage();

    await user.type(screen.getByLabelText("Ask for a change"), "Round half up instead{Enter}");

    expect(refine).toHaveBeenCalledWith({ answers: [], message: "Round half up instead" });
    expect(await screen.findByText(/Redrafting/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
  });

  it("keeps Shift+Enter as a line break instead of sending", async () => {
    const { refine, user } = renderPage();

    await user.type(screen.getByLabelText("Ask for a change"), "First line{Shift>}{Enter}{/Shift}second");

    expect(refine).not.toHaveBeenCalled();
    expect(screen.getByLabelText<HTMLTextAreaElement>("Ask for a change").value).toBe("First line\nsecond");
  });

  it("asks before a redraft replaces manual edits, and sends only once confirmed", async () => {
    const { refine, user } = renderPage();
    await user.click(screen.getByRole("tab", { name: "Edit" }));
    await user.type(screen.getByLabelText(/title/i), " half up");

    await user.type(screen.getByLabelText("Ask for a change"), "Also round refunds{Enter}");
    expect(screen.getByText(/Redrafting replaces it, so your edits will be lost/)).toBeTruthy();
    expect(refine).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Keep my edits" }));
    expect(refine).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Send" }));
    await user.click(screen.getByRole("button", { name: "Discard edits and send" }));
    expect(refine).toHaveBeenCalledWith({ answers: [], message: "Also round refunds" });
  });
});
