// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutosave } from "@/components/analysis/use-autosave";
import type { TicketDraft } from "@/core/requirements/schemas";

const draft: TicketDraft = {
  title: "Round cart totals",
  description: [
    { text: "Totals round down.", status: "inferred", evidenceIds: [] },
    { text: " ", status: "inferred", evidenceIds: [] },
  ],
  acceptanceCriteria: [],
  assumptions: [],
  openQuestions: [],
  evidence: [],
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const advance = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
};

describe("useAutosave", () => {
  it("does nothing until the draft is edited", async () => {
    const save = vi.fn(async () => ({}));
    renderHook(() => useAutosave(draft, save, false));

    await advance(1000);

    expect(save).not.toHaveBeenCalled();
  });

  it("saves once typing pauses, dropping unfinished items", async () => {
    const save = vi.fn(async () => ({}));
    const { result } = renderHook(() => useAutosave(draft, save, true));

    await advance(799);
    expect(save).not.toHaveBeenCalled();
    await advance(1);

    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith({ ...draft, description: [draft.description[0]] });
    expect(result.current).toEqual({ saved: true, error: undefined });
  });

  it("reports a save the server refused", async () => {
    const save = vi.fn(async () => ({ error: "The draft was regenerated; reload the page" }));
    const { result } = renderHook(() => useAutosave(draft, save, true));

    await advance(800);

    expect(result.current).toEqual({ saved: false, error: "The draft was regenerated; reload the page" });
  });

  it("keeps the edits on the page when the server cannot be reached", async () => {
    const save = vi.fn(async () => {
      throw new Error("offline");
    });
    const { result } = renderHook(() => useAutosave(draft, save, true));

    await advance(800);

    expect(result.current.saved).toBe(false);
    expect(result.current.error).toContain("Your edits stay on this page and save on your next change.");
  });
});
