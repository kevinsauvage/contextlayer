"use client";

import { RotateCw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Resource } from "@/core/integrations/provider";

const resourcesSchema = z.array(z.object({ id: z.string(), label: z.string() }));
const errorSchema = z.object({ error: z.string() });

type Loaded = { key: string; resources: Resource[]; error?: string };

async function fetchResources(connectionId: string): Promise<Omit<Loaded, "key">> {
  try {
    const response = await fetch(`/api/integrations/connections/${connectionId}/resources`);
    const json: unknown = await response.json();
    if (!response.ok)
      return { resources: [], error: errorSchema.safeParse(json).data?.error ?? "Could not load the list" };
    return { resources: resourcesSchema.parse(json) };
  } catch {
    return { resources: [], error: "Could not load the list. Check your connection and retry." };
  }
}

function useResources(connectionId: string) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded>();
  const key = `${connectionId}:${attempt}`;
  useEffect(() => {
    let cancelled = false;
    void fetchResources(connectionId).then((result) => {
      if (!cancelled) setLoaded({ key, ...result });
    });
    return () => {
      cancelled = true;
    };
  }, [connectionId, key]);
  const ready = loaded?.key === key;
  return {
    resources: ready ? loaded.resources : [],
    error: ready ? loaded.error : undefined,
    loading: !ready,
    retry: () => setAttempt((n) => n + 1),
  };
}

type Props = {
  connectionId: string;
  name: string;
  noun: string;
  emptyHint: string;
  onSelect: (resource: Resource) => void;
};

export function ResourcePicker({ connectionId, name, noun, emptyHint, onSelect }: Props) {
  const { resources, error, loading, retry } = useResources(connectionId);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>();
  // The checked radio stays rendered so filtering never drops the selection from the form.
  const visible = resources.filter(
    (r) => r.id === selected || r.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label={`Loading ${noun} list`}>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
      >
        {error}
        <Button type="button" variant="outline" size="sm" onClick={retry}>
          <RotateCw /> Retry
        </Button>
      </div>
    );
  }
  if (!resources.length)
    return <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{emptyHint}</p>;

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
