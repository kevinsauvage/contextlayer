"use client";

import { RotateCw, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Resource, ResourceList } from "@/core/integrations/provider";

type Props = {
  name: string;
  noun: string;
  emptyHint: string;
  list: ResourceList;
  onSelect: (resource: Resource) => void;
};

// Only filters and selects: the list itself is loaded by the Server Component that renders it.
export function ResourcePicker({ name, noun, emptyHint, list, onSelect }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>();
  const resources = "resources" in list ? list.resources : [];

  if ("error" in list) {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
      >
        {list.error}
        <Button type="button" variant="outline" size="sm" onClick={() => router.refresh()}>
          <RotateCw /> Retry
        </Button>
      </div>
    );
  }
  if (!resources.length)
    return <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{emptyHint}</p>;

  // The checked radio stays rendered so filtering never drops the selection from the form.
  const visible = resources.filter(
    (r) => r.id === selected || r.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">Choose a {noun}</legend>
      {resources.length > 6 && (
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${resources.length} ${noun === "repository" ? "repositories" : `${noun}s`}`}
            aria-label={`Search ${noun}`}
            className="pl-8"
          />
        </div>
      )}
      <div className="flex max-h-60 flex-col overflow-y-auto rounded-lg border">
        {visible.map((resource) => (
          <label
            key={resource.id}
            className="flex cursor-pointer items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/60 has-checked:bg-muted"
          >
            <input
              type="radio"
              name={name}
              value={resource.id}
              required
              checked={selected === resource.id}
              onChange={() => {
                setSelected(resource.id);
                onSelect(resource);
              }}
              className="accent-primary"
            />
            <span className="truncate">{resource.label}</span>
          </label>
        ))}
        {!visible.length && <p className="px-3 py-2 text-sm text-muted-foreground">No match for “{query}”.</p>}
      </div>
    </fieldset>
  );
}
