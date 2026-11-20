// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as Navigation from "next/navigation";
import { useMutation } from "@/components/use-mutation";

// The real `unstable_rethrow` decides which thrown errors are Next's own navigation.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(cleanup);

type Options = { onError?: (message: string) => void };

function Form({ save, onError }: { save: () => Promise<{ error?: string }>; onError?: Options["onError"] }) {
  const { run, pending, error } = useMutation({ onError });
  return (
    <form>
      <label htmlFor="answer">Answer</label>
      <input id="answer" defaultValue="typed answer" />
      <button type="button" disabled={pending} onClick={() => run(save)}>
        Save
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

describe("useMutation", () => {
  it("keeps the form and its unsaved input when the action throws", async () => {
    const user = userEvent.setup();
    render(<Form save={() => Promise.reject(new Error("connection reset"))} />);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Could not reach the server");
    expect(screen.getByLabelText("Answer")).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Answer" }).value).toBe("typed answer");
  });

  it("shows the error an action returns", async () => {
    const user = userEvent.setup();
    render(<Form save={() => Promise.resolve({ error: "The draft was regenerated; reload the page" })} />);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect((await screen.findByRole("alert")).textContent).toBe("The draft was regenerated; reload the page");
  });

  it("names the server's reference when the action failed on the server", async () => {
    const user = userEvent.setup();
    const serverError = Object.assign(new Error("An error occurred in the Server Components render"), {
      digest: "1234567",
    });
    render(<Form save={() => Promise.reject(serverError)} />);

    await user.click(screen.getByRole("button", { name: "Save" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("share this reference: 1234567");
    expect(alert.textContent).not.toContain("Could not reach the server");
  });

  it("does not report a saved change as failed when a success callback throws", async () => {
    const user = userEvent.setup();
    const save = vi.fn(() => Promise.resolve({}));
    function Saved() {
      const { run, error } = useMutation({
        onSuccess: () => {
          throw new Error("toast failed");
        },
      });
      return (
        <>
          <button type="button" onClick={() => run(save)}>
            Save
          </button>
          {error && <p role="alert">{error}</p>}
        </>
      );
    }
    const onWindowError = vi.fn((event: ErrorEvent) => event.preventDefault());
    window.addEventListener("error", onWindowError);
    const silence = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<Saved />);

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alert")).toBeNull();
    window.removeEventListener("error", onWindowError);
    silence.mockRestore();
  });

  it("hands a thrown failure to onError for a caller with nowhere to show it", async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    render(<Form save={() => Promise.reject(new Error("offline"))} onError={onError} />);

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringContaining("Could not reach the server")));
  });
});
