// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FailedDraft } from "@/components/analysis/failed-draft";
import type { TicketDraft } from "@/core/requirements/schemas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(cleanup);

const draft: TicketDraft = {
  title: "Round cart totals",
  description: [{ text: "Totals are rounded down.", status: "verified", evidenceIds: ["e1"] }],
  acceptanceCriteria: [],
  assumptions: [],
  openQuestions: [],
  evidence: [{ id: "e1", kind: "code", reference: "src/cart/loadCart.ts", excerpt: "Math.floor(total)" }],
};

describe("FailedDraft", () => {
  it("shows the previous draft and retries the stored input", async () => {
    const retry = vi.fn(async () => ({}));
    render(
      <FailedDraft
        draft={draft}
        trackerName="Jira"
        projectLabel="SHOP"
        error="The analysis took too long and was stopped. Try again."
        retry={retry}
      />,
    );

    expect(screen.getByText("The redraft failed")).toBeTruthy();
    expect(screen.getByText(/this is the previous draft/i)).toBeTruthy();
    expect(screen.getByText("Round cart totals")).toBeTruthy();

    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("keeps the server's error next to the button", async () => {
    const retry = vi.fn(async () => ({ error: "This analysis is still running" }));
    render(<FailedDraft draft={draft} trackerName="Jira" projectLabel="SHOP" error={null} retry={retry} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("This analysis is still running")).toBeTruthy();
  });
});
