"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props<T> = {
  title: string;
  hint?: string;
  items: T[];
  onChange: (items: T[]) => void;
  createItem: () => T;
  addLabel: string;
  minItems?: number;
  renderItem: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
};

export function EditableList<T>({ title, hint, items, onChange, createItem, addLabel, minItems = 0, renderItem }: Props<T>) {
  const update = (index: number, patch: Partial<T>) => onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="font-medium">{title}</h3>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {items.map((item, index) => (
        <div key={index} className="flex gap-2 rounded-lg border p-3">
          <div className="flex flex-1 flex-col gap-2">{renderItem(item, (patch) => update(index, patch))}</div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={items.length <= minItems}
            onClick={() => onChange(items.filter((_, i) => i !== index))}
            aria-label={`Remove ${title} item ${index + 1}`}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onChange([...items, createItem()])}>
        {addLabel}
      </Button>
    </section>
  );
}
