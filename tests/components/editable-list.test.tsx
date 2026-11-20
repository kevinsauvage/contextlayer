// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { EditableList } from "@/components/analysis/editable-list";

afterEach(cleanup);

type Item = { text: string };

function List({ initial, minItems }: { initial: Item[]; minItems?: number }) {
  const [items, setItems] = useState(initial);
  return (
    <EditableList
      title="Acceptance criteria"
      itemLabel="Criterion"
      items={items}
      minItems={minItems}
      onChange={setItems}
      createItem={() => ({ text: "" })}
      addLabel="Add criterion"
      renderItem={(item, _update, label) => <input aria-label={label} defaultValue={item.text} />}
    />
  );
}

describe("EditableList", () => {
  it("labels each item and its remove button, and names the add button", () => {
    render(<List initial={[{ text: "One" }, { text: "Two" }]} />);

    expect(screen.getByRole("group", { name: "Criterion 1" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Criterion 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove criterion 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add criterion" })).toBeTruthy();
  });

  it("disables remove when the list is at its minimum", () => {
    render(<List initial={[{ text: "Only" }]} minItems={1} />);

    expect(screen.getByRole("button", { name: "Remove criterion 1" })).toHaveProperty("disabled", true);
  });

  it("moves focus to the next field after a removal", async () => {
    const user = userEvent.setup();
    render(<List initial={[{ text: "One" }, { text: "Two" }, { text: "Three" }]} />);

    await user.click(screen.getByRole("button", { name: "Remove criterion 2" }));

    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Criterion 2" }));
    expect(screen.queryByRole("textbox", { name: "Criterion 3" })).toBeNull();
  });

  it("moves focus to the add button when the last item is removed", async () => {
    const user = userEvent.setup();
    render(<List initial={[{ text: "Only" }]} />);

    await user.click(screen.getByRole("button", { name: "Remove criterion 1" }));

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Add criterion" }));
  });

  it("adds an item and focuses it", async () => {
    const user = userEvent.setup();
    render(<List initial={[{ text: "One" }]} />);

    await user.click(screen.getByRole("button", { name: "Add criterion" }));

    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Criterion 2" }));
  });
});
