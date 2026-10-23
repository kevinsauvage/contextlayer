"use client";

import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border p-6">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        The page could not load. Try again; if it keeps failing, share this reference with support:{" "}
        <code>{error.digest ?? "n/a"}</code>
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
