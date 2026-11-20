// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "@/components/auth/auth-form";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { SwitchAccountButton } from "@/components/auth/switch-account-button";
import { AcceptInvitation } from "@/components/organization/accept-invitation";
import { OrganizationNameForm } from "@/components/organization/organization-name-form";

const state = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  setActive: vi.fn(),
  createOrganization: vi.fn(),
  renameOrganization: vi.fn(),
  acceptInvitation: vi.fn(),
  rejectInvitation: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push, refresh: state.refresh }) }));
vi.mock("@/infrastructure/auth/client", () => ({
  authClient: {
    signIn: { email: state.signIn },
    signUp: { email: state.signUp },
    signOut: state.signOut,
    organization: { setActive: state.setActive },
  },
}));
vi.mock("@/features/organizations/actions", () => ({
  createOrganization: state.createOrganization,
  renameOrganization: state.renameOrganization,
  acceptInvitation: state.acceptInvitation,
  rejectInvitation: state.rejectInvitation,
}));
vi.mock("@/components/ui/toast", () => ({ notify: vi.fn(), notifyError: vi.fn() }));

afterEach(() => {
  cleanup();
  Object.values(state).forEach((mock) => mock.mockClear());
});

describe("AuthForm", () => {
  it("signs in and respects the next path", async () => {
    state.signIn.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<AuthForm mode="sign-in" next="/projects/abc" />);

    await user.type(screen.getByLabelText("Email"), "ada@example.test");
    await user.type(screen.getByLabelText("Password"), "password-1234");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(state.signIn).toHaveBeenCalledWith({ email: "ada@example.test", password: "password-1234" }),
    );
    await waitFor(() => expect(state.push).toHaveBeenCalledWith("/projects/abc"));
  });

  it("shows the auth error and stays on the page", async () => {
    state.signIn.mockResolvedValue({ error: { message: "Invalid email or password", status: 401 } });
    const user = userEvent.setup();
    render(<AuthForm mode="sign-in" />);

    await user.type(screen.getByLabelText("Email"), "ada@example.test");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Invalid email or password");
    expect(state.push).not.toHaveBeenCalled();
  });

  it("creates an account with a name and a password hint", async () => {
    state.signUp.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<AuthForm mode="sign-up" />);

    expect(screen.getByText("At least 10 characters.")).toBeTruthy();
    await user.type(screen.getByLabelText("Name"), "Ada Lovelace");
    await user.type(screen.getByLabelText("Email"), "ada@example.test");
    await user.type(screen.getByLabelText("Password"), "password-1234");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(state.signUp).toHaveBeenCalledWith({
        email: "ada@example.test",
        password: "password-1234",
        name: "Ada Lovelace",
      }),
    );
    await waitFor(() => expect(state.push).toHaveBeenCalledWith("/projects"));
  });

  it("ignores an absolute next path", () => {
    render(<AuthForm mode="sign-in" next="https://evil.test" />);
    expect(screen.getByRole("link", { name: "Sign up" }).getAttribute("href")).toBe(
      "/sign-up?next=https%3A%2F%2Fevil.test",
    );
  });
});

describe("OnboardingForm", () => {
  it("refuses a name shorter than two characters without calling the server", async () => {
    const user = userEvent.setup();
    render(<OnboardingForm />);

    await user.type(screen.getByLabelText("Organization name"), "A");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("alert").textContent).toBe("Enter a name of at least 2 characters");
    expect(state.createOrganization).not.toHaveBeenCalled();
  });

  it("creates the organization, activates it and opens the projects page", async () => {
    state.createOrganization.mockResolvedValue({ organizationId: "org-1" });
    state.setActive.mockResolvedValue({});
    const user = userEvent.setup();
    render(<OnboardingForm submitLabel="Create" />);

    await user.type(screen.getByLabelText("Organization name"), "Acme");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(state.createOrganization).toHaveBeenCalledWith("Acme"));
    await waitFor(() => expect(state.setActive).toHaveBeenCalledWith({ organizationId: "org-1" }));
    await waitFor(() => expect(state.push).toHaveBeenCalledWith("/projects"));
  });

  it("shows a server refusal", async () => {
    state.createOrganization.mockResolvedValue({ error: "The name is already taken" });
    const user = userEvent.setup();
    render(<OnboardingForm />);

    await user.type(screen.getByLabelText("Organization name"), "Acme");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect((await screen.findByRole("alert")).textContent).toBe("The name is already taken");
    expect(state.setActive).not.toHaveBeenCalled();
  });
});

describe("OrganizationNameForm", () => {
  it("renames with the trimmed value", async () => {
    state.renameOrganization.mockResolvedValue({});
    const user = userEvent.setup();
    render(<OrganizationNameForm name="Acme" canEdit />);

    const field = screen.getByLabelText("Name");
    await user.clear(field);
    await user.type(field, "  New name  ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(state.renameOrganization).toHaveBeenCalledWith("New name"));
  });

  it("validates before calling the server", async () => {
    const user = userEvent.setup();
    render(<OrganizationNameForm name="Acme" canEdit />);

    const field = screen.getByLabelText("Name");
    await user.clear(field);
    await user.type(field, "A");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert").textContent).toBe("Enter a name of at least 2 characters");
    expect(state.renameOrganization).not.toHaveBeenCalled();
  });

  it("is read-only for a member", () => {
    render(<OrganizationNameForm name="Acme" canEdit={false} />);

    expect(screen.getByLabelText<HTMLInputElement>("Name").disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });
});

describe("AcceptInvitation", () => {
  it("accepts, activates the organization and opens the projects page", async () => {
    state.acceptInvitation.mockResolvedValue({ organizationId: "org-1" });
    state.setActive.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AcceptInvitation invitationId="inv-1" />);

    await user.click(screen.getByRole("button", { name: "Accept and join" }));

    await waitFor(() => expect(state.acceptInvitation).toHaveBeenCalledWith("inv-1"));
    await waitFor(() => expect(state.setActive).toHaveBeenCalledWith({ organizationId: "org-1" }));
    await waitFor(() => expect(state.push).toHaveBeenCalledWith("/projects"));
  });

  it("declines without activating anything", async () => {
    state.rejectInvitation.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AcceptInvitation invitationId="inv-1" />);

    await user.click(screen.getByRole("button", { name: "Decline" }));

    await waitFor(() => expect(state.rejectInvitation).toHaveBeenCalledWith("inv-1"));
    await waitFor(() => expect(state.push).toHaveBeenCalledWith("/projects"));
    expect(state.setActive).not.toHaveBeenCalled();
  });

  it("shows a refusal", async () => {
    state.acceptInvitation.mockResolvedValue({ error: "This invitation was already used" });
    const user = userEvent.setup();
    render(<AcceptInvitation invitationId="inv-1" />);

    await user.click(screen.getByRole("button", { name: "Accept and join" }));

    expect((await screen.findByRole("alert")).textContent).toBe("This invitation was already used");
  });
});

describe("SwitchAccountButton", () => {
  it("signs out and returns to the invitation", async () => {
    state.signOut.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<SwitchAccountButton next="/invitations/inv-1" />);

    await user.click(screen.getByRole("button", { name: "Sign in with another account" }));

    await waitFor(() => expect(state.signOut).toHaveBeenCalledOnce());
    await waitFor(() => expect(state.push).toHaveBeenCalledWith("/sign-in?next=%2Finvitations%2Finv-1"));
  });
});
