// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";

const deleteProject = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("@/features/projects/actions", () => ({ deleteProject }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/ui/toast", () => ({ notify: vi.fn(), notifyError: vi.fn() }));

afterEach(() => {
  cleanup();
  deleteProject.mockReset();
});

describe("DeleteProjectButton", () => {
  it("names the project in the confirmation and deletes it", async () => {
    const user = userEvent.setup();
    render(<DeleteProjectButton projectId="p1" name="Storefront" />);

    await user.click(screen.getByRole("button", { name: "Delete project" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Delete Storefront?")).toBeTruthy();
    expect(within(dialog).getByText(/Tickets already published stay/)).toBeTruthy();

    await user.click(within(dialog).getByRole("button", { name: "Delete project" }));

    await waitFor(() => expect(deleteProject).toHaveBeenCalledWith("p1"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("keeps the dialog open with the refusal", async () => {
    deleteProject.mockResolvedValue({ error: "Only organization owners and admins can do this." });
    const user = userEvent.setup();
    render(<DeleteProjectButton projectId="p1" name="Storefront" />);

    await user.click(screen.getByRole("button", { name: "Delete project" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete project" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Only organization owners and admins can do this.");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });
});
