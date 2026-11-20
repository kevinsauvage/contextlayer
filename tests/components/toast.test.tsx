// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Toaster, notify, notifyError } from "@/components/ui/toast";

afterEach(cleanup);

describe("toasts", () => {
  it("shows a success confirmation", async () => {
    render(<Toaster />);

    act(() => {
      void notify("Member removed.");
    });

    expect(await screen.findByText("Member removed.")).toBeTruthy();
  });

  it("shows an error with a dismiss control", async () => {
    render(<Toaster />);

    act(() => {
      void notifyError("Could not reach the server.");
    });

    expect((await screen.findAllByText("Could not reach the server.")).length).toBeGreaterThan(0);
  });
});
