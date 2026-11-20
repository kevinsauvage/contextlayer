// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DangerZone } from "@/components/organization/danger-zone";

const actions = vi.hoisted(() => ({
  leaveOrganization: vi.fn(),
  deleteOrganization: vi.fn(),
}));

vi.mock("@/features/organizations/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/ui/toast", () => ({ notify: vi.fn(), notifyError: vi.fn() }));

afterEach(() => {
  cleanup();
  actions.leaveOrganization.mockReset();
  actions.deleteOrganization.mockReset();
});

describe("DangerZone", () => {
  it("confirms before leaving the organization", async () => {
    actions.leaveOrganization.mockResolvedValue({});
    const user = userEvent.setup();
    render(<DangerZone organizationName="Acme" isOwner={false} />);

    await user.click(screen.getByRole("button", { name: "Leave organization" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText("Leave Acme?")).toBeTruthy();

    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Leave organization" }));
    await waitFor(() => expect(actions.leaveOrganization).toHaveBeenCalledOnce());
  });

  it("hides organization deletion from a non-owner", () => {
    render(<DangerZone organizationName="Acme" isOwner={false} />);
    expect(screen.queryByRole("button", { name: "Delete organization" })).toBeNull();
  });

  it("requires the organization name before deleting it", async () => {
    actions.deleteOrganization.mockResolvedValue({});
    const user = userEvent.setup();
    render(<DangerZone organizationName="Acme" isOwner />);

    await user.click(screen.getByRole("button", { name: "Delete organization" }));
    const confirm = screen.getAllByRole("button", { name: "Delete organization" }).at(-1) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    await user.type(screen.getByLabelText(/Type Acme to confirm/), "Acme");
    expect(confirm.disabled).toBe(false);

    await user.click(confirm);
    await waitFor(() => expect(actions.deleteOrganization).toHaveBeenCalledOnce());
  });

  it("clears the typed confirmation when the dialog is dismissed", async () => {
    const user = userEvent.setup();
    render(<DangerZone organizationName="Acme" isOwner />);

    await user.click(screen.getByRole("button", { name: "Delete organization" }));
    await user.type(screen.getByLabelText(/Type Acme to confirm/), "Ac");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await user.click(screen.getByRole("button", { name: "Delete organization" }));
    expect(screen.getByLabelText<HTMLInputElement>(/Type Acme to confirm/).value).toBe("");
  });

  it("shows a refused deletion and keeps the dialog open", async () => {
    actions.deleteOrganization.mockResolvedValue({ error: "You cannot delete the last organization" });
    const user = userEvent.setup();
    render(<DangerZone organizationName="Acme" isOwner />);

    await user.click(screen.getByRole("button", { name: "Delete organization" }));
    await user.type(screen.getByLabelText(/Type Acme to confirm/), "Acme");
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete organization" }));

    expect((await screen.findByRole("alert")).textContent).toBe("You cannot delete the last organization");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });
});
