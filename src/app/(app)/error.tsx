"use client";

import { Button } from "@/components/ui/button";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border p-6">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        The page could not load. Try again; if it keeps failing, share this reference:{" "}
        <code>{error.digest ?? "n/a"}</code>
      </p>
      <Button onClick={retry}>Try again</Button>
    </div>
  );
}
