// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyLinkButton } from "@/components/copy-button";

afterEach(cleanup);

const setClipboard = (writeText: (text: string) => Promise<void>) =>
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

describe("CopyLinkButton", () => {
  it("copies the absolute link and confirms it", async () => {
    const writeText = vi.fn(async () => undefined);
    const user = userEvent.setup();
    setClipboard(writeText);
    render(<CopyLinkButton path="/invitations/inv-1" />);

    await user.click(screen.getByRole("button", { name: "Copy link" }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/invitations/inv-1`);
    expect(await screen.findByText("Copied")).toBeTruthy();
  });

  it("hands the link over in a selected field when the clipboard refuses", async () => {
    const user = userEvent.setup();
    setClipboard(async () => {
      throw new Error("denied");
    });
    render(<CopyLinkButton path="/invitations/inv-2" fieldLabel="Invitation link" />);

    await user.click(screen.getByRole("button", { name: "Copy link" }));

    const field = await screen.findByLabelText<HTMLInputElement>("Invitation link");
    expect(field.value).toBe(`${window.location.origin}/invitations/inv-2`);
    expect(field.readOnly).toBe(true);
    expect(document.activeElement).toBe(field);
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe(field.value.length);
    expect(screen.getByText("Copy failed; select the link below")).toBeTruthy();
  });

  it("recovers on a later successful copy", async () => {
    const writeText = vi
      .fn<(text: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error("denied"))
      .mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    setClipboard(writeText);
    render(<CopyLinkButton path="/invitations/inv-3" />);

    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(await screen.findByRole("textbox", { name: "Link" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Copy failed/ }));
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Link" })).toBeNull());
    expect(screen.getByText("Copied")).toBeTruthy();
  });
});
