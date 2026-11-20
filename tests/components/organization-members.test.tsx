// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InviteForm } from "@/components/organization/invite-form";
import { CancelInvitationButton, RemoveMemberButton } from "@/components/organization/member-actions";
import { MemberRoleSelect } from "@/components/organization/member-role-select";

const actions = vi.hoisted(() => ({
  inviteMember: vi.fn(),
  removeMember: vi.fn(),
  cancelInvitation: vi.fn(),
  updateMemberRole: vi.fn(),
}));

vi.mock("@/features/organizations/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/ui/toast", () => ({ notify: vi.fn(), notifyError: vi.fn() }));

afterEach(() => {
  cleanup();
  Object.values(actions).forEach((action) => action.mockReset());
});

describe("InviteForm", () => {
  it("invites with the chosen role and shows the link to send", async () => {
    actions.inviteMember.mockResolvedValue({ invitationId: "inv-1", email: "teammate@company.test" });
    const user = userEvent.setup();
    render(<InviteForm />);

    await user.type(screen.getByLabelText("Email"), "teammate@company.test");
    await user.selectOptions(screen.getByLabelText("Role"), "admin");
    await user.click(screen.getByRole("button", { name: "Create invite" }));

    await waitFor(() => expect(actions.inviteMember).toHaveBeenCalledWith("teammate@company.test", "admin"));
    expect(screen.getByRole("status").textContent).toContain("Invitation for teammate@company.test created");
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
  });

  it("falls back to the member role for an unknown value", async () => {
    actions.inviteMember.mockResolvedValue({ invitationId: "inv-2", email: "new@company.test" });
    const user = userEvent.setup();
    render(<InviteForm />);

    await user.type(screen.getByLabelText("Email"), "new@company.test");
    await user.click(screen.getByRole("button", { name: "Create invite" }));

    await waitFor(() => expect(actions.inviteMember).toHaveBeenCalledWith("new@company.test", "member"));
  });

  it("shows the refusal next to the form", async () => {
    actions.inviteMember.mockResolvedValue({ error: "That person is already a member" });
    const user = userEvent.setup();
    render(<InviteForm />);

    await user.type(screen.getByLabelText("Email"), "member@company.test");
    await user.click(screen.getByRole("button", { name: "Create invite" }));

    expect((await screen.findByRole("alert")).textContent).toBe("That person is already a member");
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("MemberRoleSelect", () => {
  it("updates the role and disables while pending", async () => {
    actions.updateMemberRole.mockResolvedValue({});
    const user = userEvent.setup();
    render(<MemberRoleSelect memberId="m1" role="member" />);

    const select = screen.getByRole("combobox", { name: "Member role" });
    await user.selectOptions(select, "admin");

    expect(actions.updateMemberRole).toHaveBeenCalledWith("m1", "admin");
  });

  it("shows the error and stays on the old role when the server refuses", async () => {
    actions.updateMemberRole.mockResolvedValue({ error: "You cannot change this member's role" });
    const user = userEvent.setup();
    render(<MemberRoleSelect memberId="m1" role="member" />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Member role" }), "admin");

    expect((await screen.findByRole("alert")).textContent).toBe("You cannot change this member's role");
  });

  it("is disabled when the row is not editable", () => {
    render(<MemberRoleSelect memberId="m1" role="owner" disabled />);
    expect(screen.getByRole<HTMLSelectElement>("combobox", { name: "Member role" }).disabled).toBe(true);
  });
});

describe("member actions", () => {
  it("removes a member and confirms", async () => {
    actions.removeMember.mockResolvedValue({});
    const user = userEvent.setup();
    render(<RemoveMemberButton memberId="m1" />);

    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(actions.removeMember).toHaveBeenCalledWith("m1"));
  });

  it("revokes an invitation and shows the refusal", async () => {
    actions.cancelInvitation.mockResolvedValue({ error: "That invitation no longer exists" });
    const user = userEvent.setup();
    render(<CancelInvitationButton invitationId="inv-1" />);

    await user.click(screen.getByRole("button", { name: "Revoke" }));

    await waitFor(() => expect(actions.cancelInvitation).toHaveBeenCalledWith("inv-1"));
    expect((await screen.findByRole("alert")).textContent).toBe("That invitation no longer exists");
  });
});
