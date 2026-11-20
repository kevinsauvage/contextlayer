// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmButton } from "@/components/confirm-button";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/ui/toast", () => ({ notify: vi.fn(), notifyError: vi.fn() }));

afterEach(cleanup);

const props = {
  trigger: "Disconnect",
  title: "Disconnect Acme?",
  description: "ContextLayer forgets this connection.",
  confirmLabel: "Disconnect",
  pendingLabel: "Disconnecting…",
  success: "Acme disconnected.",
};

describe("ConfirmButton", () => {
  it("runs the action only after the confirmation", async () => {
    const action = vi.fn(async () => ({}));
    const user = userEvent.setup();
    render(<ConfirmButton {...props} action={action} />);

    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText("Disconnect Acme?")).toBeTruthy();
    expect(action).not.toHaveBeenCalled();

    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("closes without running the action on cancel", async () => {
    const action = vi.fn(async () => ({}));
    const user = userEvent.setup();
    render(<ConfirmButton {...props} action={action} />);

    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(action).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and shows the error when the action refuses", async () => {
    const action = vi.fn(async () => ({ error: "The connection is still in use" }));
    const user = userEvent.setup();
    render(<ConfirmButton {...props} action={action} />);

    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Disconnect" }));

    expect((await screen.findByRole("alert")).textContent).toBe("The connection is still in use");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });
});
