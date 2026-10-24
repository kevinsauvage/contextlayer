"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props<T> = {
  title: string;
  // Singular name for one entry, e.g. "Acceptance criterion"; numbered to label each item.
  itemLabel: string;
  hint?: string;
  items: T[];
  onChange: (items: T[]) => void;
  createItem: () => T;
  addLabel: string;
  minItems?: number;
  renderItem: (item: T, update: (patch: Partial<T>) => void, label: string) => ReactNode;
};

const FIELDS = "textarea, input, select";

export function EditableList<T>({
  title,
  itemLabel,
  hint,
  items,
  onChange,
  createItem,
  addLabel,
  minItems = 0,
  renderItem,
}: Props<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  // Removing or adding an item would otherwise drop keyboard focus to the page.
  const focusIndex = useRef<number | null>(null);

  useEffect(() => {
    if (focusIndex.current === null) return;
    const field = listRef.current?.children[focusIndex.current]?.querySelector<HTMLElement>(FIELDS);
    (field ?? addRef.current)?.focus();
    focusIndex.current = null;
  }, [items.length]);

  const update = (index: number, patch: Partial<T>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
    focusIndex.current = Math.min(index, items.length - 2);
  };
  const add = () => {
    onChange([...items, createItem()]);
    focusIndex.current = items.length;
  };

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="font-medium">{title}</h3>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      <div ref={listRef} className="flex flex-col gap-3">
        {items.map((item, index) => {
          const label = `${itemLabel} ${index + 1}`;
          return (
            <div key={index} role="group" aria-label={label} className="flex gap-2 rounded-lg border p-3">
              <div className="flex flex-1 flex-col gap-2">
                {renderItem(item, (patch) => update(index, patch), label)}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={items.length <= minItems}
                onClick={() => remove(index)}
                aria-label={`Remove ${label.toLowerCase()}`}
              >
                Remove
              </Button>
            </div>
          );
        })}
      </div>
      <Button ref={addRef} type="button" variant="outline" size="sm" className="self-start" onClick={add}>
        {addLabel}
      </Button>
    </section>
  );
}
