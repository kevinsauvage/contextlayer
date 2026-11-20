// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrgSwitcher } from "@/components/organization/org-switcher";
import { UserMenu } from "@/components/layout/user-menu";

const state = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  setTheme: vi.fn(),
  setActive: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push, refresh: state.refresh }) }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "system", setTheme: state.setTheme }) }));
vi.mock("@/infrastructure/auth/client", () => ({
  authClient: {
    organization: { setActive: state.setActive },
    signOut: state.signOut,
  },
}));
vi.mock("@/components/ui/toast", () => ({ notify: vi.fn(), notifyError: vi.fn() }));

afterEach(() => {
  cleanup();
  Object.values(state).forEach((mock) => mock.mockClear());
});

const organizations = [
  { id: "orgA", name: "Acme", role: "owner" },
  { id: "orgB", name: "Beta", role: "member" },
];

describe("OrgSwitcher", () => {
  it("names its trigger from the visible organization name", () => {
    render(<OrgSwitcher organizations={organizations} activeId="orgA" />);

    const trigger = screen.getByRole("button", { name: /Acme/ });
    expect(trigger.textContent).toContain("Acme");
  });

  it("lists the organizations and marks the current one", async () => {
    const user = userEvent.setup();
    render(<OrgSwitcher organizations={organizations} activeId="orgA" />);

    await user.click(screen.getByRole("button", { name: /Acme/ }));

    expect(await screen.findByRole("menuitem", { name: /Acme/ })).toBeTruthy();
    expect(await screen.findByRole("menuitem", { name: /Beta/ })).toBeTruthy();
    expect(screen.getByLabelText("Current")).toBeTruthy();
  });

  it("switches to another organization and lands on the projects page", async () => {
    state.setActive.mockResolvedValue({});
    const user = userEvent.setup();
    render(<OrgSwitcher organizations={organizations} activeId="orgA" />);

    await user.click(screen.getByRole("button", { name: /Acme/ }));
    await user.click(await screen.findByRole("menuitem", { name: /Beta/ }));

    await waitFor(() => expect(state.setActive).toHaveBeenCalledWith({ organizationId: "orgB" }));
    await waitFor(() => expect(state.push).toHaveBeenCalledWith("/projects"));
  });

  it("does nothing when the current organization is chosen", async () => {
    const user = userEvent.setup();
    render(<OrgSwitcher organizations={organizations} activeId="orgA" />);

    await user.click(screen.getByRole("button", { name: /Acme/ }));
    await user.click(await screen.findByRole("menuitem", { name: /Acme/ }));

    expect(state.setActive).not.toHaveBeenCalled();
  });

  it("offers the organization settings and the new-organization page", async () => {
    const user = userEvent.setup();
    render(<OrgSwitcher organizations={organizations} activeId="orgA" />);

    await user.click(screen.getByRole("button", { name: /Acme/ }));
    await user.click(await screen.findByRole("menuitem", { name: /Organization settings/ }));
    expect(state.push).toHaveBeenCalledWith("/settings/organization");
  });
});

describe("UserMenu", () => {
  it("names its trigger from the signed-in user", async () => {
    render(<UserMenu name="Ada Lovelace" email="ada@example.test" />);

    const trigger = screen.getByRole("button", { name: /Ada Lovelace/ });
    expect(trigger.textContent).toContain("AL");
  });

  it("shows the name, email and theme choices", async () => {
    const user = userEvent.setup();
    render(<UserMenu name="Ada Lovelace" email="ada@example.test" variant="full" />);

    await user.click(screen.getByRole("button", { name: /Ada Lovelace/ }));

    expect(screen.getByText("ada@example.test")).toBeTruthy();
    expect((await screen.findByRole("menuitemradio", { name: /System/ })).getAttribute("aria-checked")).toBe("true");
    await user.click(await screen.findByRole("menuitemradio", { name: /Dark/ }));
    expect(state.setTheme).toHaveBeenCalledWith("dark");
  });

  it("signs out and returns to the sign-in page", async () => {
    state.signOut.mockResolvedValue({});
    const user = userEvent.setup();
    render(<UserMenu name="Ada Lovelace" email="ada@example.test" />);

    await user.click(screen.getByRole("button", { name: /Ada Lovelace/ }));
    await user.click(await screen.findByRole("menuitem", { name: /Sign out/ }));

    await waitFor(() => expect(state.signOut).toHaveBeenCalledOnce());
    await waitFor(() => expect(state.push).toHaveBeenCalledWith("/sign-in"));
  });

  it("stays on the page and reports a failed sign-out", async () => {
    state.signOut.mockResolvedValue({ error: { message: "Session already expired", status: 401 } });
    const user = userEvent.setup();
    render(<UserMenu name="Ada Lovelace" email="ada@example.test" />);

    await user.click(screen.getByRole("button", { name: /Ada Lovelace/ }));
    await user.click(await screen.findByRole("menuitem", { name: /Sign out/ }));

    await waitFor(() => expect(state.signOut).toHaveBeenCalledOnce());
    expect(state.push).not.toHaveBeenCalled();
  });
});
