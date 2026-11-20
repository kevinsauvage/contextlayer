// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResourcePicker } from "@/components/integrations/resource-picker";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  cleanup();
  refresh.mockClear();
});

const resources = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `repo-${index}`, label: `acme/repo-${index}` }));

describe("ResourcePicker", () => {
  it("shows a recoverable error with a retry", async () => {
    const user = userEvent.setup();
    render(
      <ResourcePicker
        name="sourceResourceId"
        noun="repository"
        emptyHint="Nothing"
        list={{ error: "The grant expired" }}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain("The grant expired");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows the empty hint when the account can see nothing", () => {
    render(
      <ResourcePicker
        name="sourceResourceId"
        noun="repository"
        emptyHint="No repository"
        list={{ resources: [] }}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("No repository")).toBeTruthy();
  });

  it("renders a short list as radios without a search field", () => {
    render(
      <ResourcePicker
        name="sourceResourceId"
        noun="repository"
        emptyHint="Nothing"
        list={{ resources: resources(3) }}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("filters a long list and keeps the selected resource visible", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <ResourcePicker
        name="sourceResourceId"
        noun="repository"
        emptyHint="Nothing"
        list={{ resources: resources(8) }}
        onSelect={onSelect}
      />,
    );

    const search = screen.getByRole("searchbox", { name: "Search repository" });
    await user.type(search, "nothing");
    expect(screen.getByText(/No match for/)).toBeTruthy();

    await user.clear(search);
    await user.type(search, "repo-7");
    expect(screen.getAllByRole("radio")).toHaveLength(1);

    await user.click(screen.getByRole("radio", { name: "acme/repo-7" }));
    expect(onSelect).toHaveBeenCalledWith({ id: "repo-7", label: "acme/repo-7" });

    await user.clear(search);
    await user.type(search, "nothing");
    // The checked radio stays rendered, so the form still submits the selection.
    expect(screen.getAllByRole("radio")).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "acme/repo-7" })).toHaveProperty("checked", true);
  });

  it("labels the group with the resource noun", () => {
    render(
      <ResourcePicker
        name="trackerResourceId"
        noun="project"
        emptyHint="Nothing"
        list={{ resources: resources(1) }}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("group", { name: "Choose a project" })).toBeTruthy();
  });
});
