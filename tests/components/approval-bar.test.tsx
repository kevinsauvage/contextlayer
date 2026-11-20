// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApprovalBar } from "@/components/analysis/approval-bar";

afterEach(cleanup);

const props = {
  publishLabel: "Approve & create in Jira",
  trackerName: "Jira",
  target: "Creates a new issue in SHOP",
  labelled: 0,
  unresolved: [] as string[],
  unappliedAnswers: 0,
  blocking: 0,
  pending: false,
  updating: false,
  onApprove: vi.fn(),
};

describe("ApprovalBar", () => {
  it("publishes directly when nothing is left to decide", async () => {
    const onApprove = vi.fn();
    const user = userEvent.setup();
    render(<ApprovalBar {...props} onApprove={onApprove} />);

    expect(screen.getByText("Nothing left to decide")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Approve & create in Jira" }));

    expect(onApprove).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("asks for confirmation when open questions or warnings remain", async () => {
    const onApprove = vi.fn();
    const user = userEvent.setup();
    render(
      <ApprovalBar
        {...props}
        onApprove={onApprove}
        unresolved={["1 open question", "1 claim decides an open question"]}
        labelled={2}
      />,
    );

    expect(screen.getByText(/1 open question · 1 claim decides an open question/)).toBeTruthy();
    expect(screen.getByText(/with 2 labelled claims/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Approve & create in Jira" }));
    expect(onApprove).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Still unresolved");

    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("alert")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Approve & create in Jira" }));
    await user.click(screen.getByRole("button", { name: "Publish anyway" }));
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it("mentions answers that were not applied in the confirmation", async () => {
    const user = userEvent.setup();
    render(<ApprovalBar {...props} unresolved={["1 open question"]} unappliedAnswers={2} />);

    await user.click(screen.getByRole("button", { name: "Approve & create in Jira" }));
    expect(screen.getByRole("alert").textContent).toContain("Answers you have not applied are not included.");
  });

  it("blocks approval while a claim contradicts its evidence", () => {
    render(<ApprovalBar {...props} blocking={1} unresolved={["1 claim does not match its evidence"]} />);

    const approve = screen.getByRole<HTMLButtonElement>("button", { name: "Approve & create in Jira" });
    expect(approve.disabled).toBe(true);
    expect(approve.title).toBe("Fix the claims that do not match their evidence first");
  });

  it("asks once before overwriting an existing ticket, even when the draft is settled", async () => {
    const onApprove = vi.fn();
    const user = userEvent.setup();
    render(
      <ApprovalBar
        {...props}
        onApprove={onApprove}
        publishLabel="Approve & update the Jira ticket"
        overwrite="Replaces the title and description of SHOP-12."
      />,
    );

    expect(screen.getByText("Nothing left to decide")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Approve & update the Jira ticket" }));
    expect(onApprove).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Replaces the title and description of SHOP-12.");

    await user.click(screen.getByRole("button", { name: "Replace the ticket" }));
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it("waits for a redraft or a publish in flight", () => {
    const { rerender } = render(<ApprovalBar {...props} updating pending />);
    expect(screen.getByRole("button", { name: "Publishing…" })).toHaveProperty("disabled", true);

    rerender(<ApprovalBar {...props} updating pending={false} />);
    expect(screen.getByRole("button", { name: "Waiting for the draft…" })).toHaveProperty("disabled", true);
  });
});
