// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FlashToast } from "@/components/flash-toast";

const state = vi.hoisted(() => ({ params: new URLSearchParams(), pathname: "/projects" }));
const notify = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useSearchParams: () => state.params,
}));
vi.mock("@/components/ui/toast", () => ({ notify, notifyError: vi.fn() }));

afterEach(() => {
  cleanup();
  notify.mockReset();
  state.params = new URLSearchParams();
  state.pathname = "/projects";
});

describe("FlashToast", () => {
  it("shows a listed message once and drops the parameter", () => {
    state.params = new URLSearchParams("notice=project_created&tab=2");
    const replace = vi.spyOn(window.history, "replaceState");

    render(<FlashToast />);

    expect(notify).toHaveBeenCalledWith("Project created. Describe what you need to draft your first ticket.");
    expect(replace).toHaveBeenCalledWith(null, "", "/projects?tab=2");
  });

  it("does nothing for an unknown or missing key", () => {
    const replace = vi.spyOn(window.history, "replaceState");
    state.params = new URLSearchParams("notice=injected");
    const { rerender } = render(<FlashToast />);
    expect(notify).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();

    state.params = new URLSearchParams();
    rerender(<FlashToast />);
    expect(notify).not.toHaveBeenCalled();
  });
});
