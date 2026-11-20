// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionForm } from "@/components/action-form";

afterEach(cleanup);

const props = {
  name: "request",
  title: "Draft a ticket",
  description: "Describe the change.",
  placeholder: "Change the banner",
  submitLabel: "Draft ticket",
  pendingLabel: "Drafting…",
};

describe("ActionForm", () => {
  it("submits the value and shows the returned error", async () => {
    const action = vi.fn(async (_state: unknown, _formData: FormData) => ({
      error: "Describe what you need in at least a few words",
    }));
    const user = userEvent.setup();
    render(<ActionForm {...props} action={action} />);

    await user.type(screen.getByLabelText("Draft a ticket"), "Fix it");
    await user.click(screen.getByRole("button", { name: "Draft ticket" }));

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(action.mock.calls[0]?.[1]).toBeInstanceOf(FormData);
    expect((await screen.findByRole("alert")).textContent).toBe("Describe what you need in at least a few words");
  });

  it("keeps the typed value after a failed submit, so it can be corrected", async () => {
    const action = vi.fn(async (_state: unknown, _formData: FormData) => ({ error: "Too short" }));
    const user = userEvent.setup();
    render(<ActionForm {...props} action={action} multiline />);

    const field = screen.getByLabelText<HTMLTextAreaElement>("Draft a ticket");
    await user.type(field, "Fix it");
    await user.click(screen.getByRole("button", { name: "Draft ticket" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByLabelText<HTMLTextAreaElement>("Draft a ticket").value).toBe("Fix it");
    expect(screen.getByLabelText("Draft a ticket").getAttribute("aria-invalid")).toBe("true");
  });

  it("submits a multiline form with the keyboard shortcut", async () => {
    const action = vi.fn(async (_state: unknown, _formData: FormData) => ({}));
    const user = userEvent.setup();
    render(<ActionForm {...props} action={action} multiline />);

    await user.type(screen.getByLabelText("Draft a ticket"), "Fix it");
    await user.keyboard("{Meta>}{Enter}{/Meta}");

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
  });

  it("seeds the field with the caller's value", () => {
    render(
      <ActionForm
        {...props}
        action={vi.fn(async (_state: unknown, _formData: FormData) => ({}))}
        defaultValue="Existing request"
      />,
    );
    expect(screen.getByLabelText<HTMLInputElement>("Draft a ticket").value).toBe("Existing request");
  });
});
