"use client";

import { unstable_rethrow, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { notify } from "@/components/ui/toast";
import { errorSummary } from "@/core/errors";

type MutationOptions = {
  // Refresh the current route after success so server-rendered data catches up.
  refresh?: boolean;
  onSuccess?: () => void;
  // Shown as a toast after success, for actions whose only other trace is a row changing or disappearing.
  success?: string;
  // For a caller with nowhere to show the error, such as a menu that closes on click.
  onError?: (message: string) => void;
};

type MutationResult = { error?: string } | undefined;

// A thrown call keeps the page and what the person typed. A failure the server reported carries a digest that matches
// its log; anything else never got an answer (a dropped connection, a deploy mid-request).
function thrownMessage(thrown: unknown): string {
  const digest = thrown instanceof Error && "digest" in thrown ? String(thrown.digest) : undefined;
  return digest
    ? `The server could not complete this. Try again; if it keeps failing, share this reference: ${digest}`
    : "Could not reach the server. Your changes are still on this page; try again.";
}

// Runs one client-side mutation and reports its error; a returned `error` keeps it on screen.
export function useMutation({ refresh = false, onSuccess, success, onError }: MutationOptions = {}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const fail = (message: string) => {
    setError(message);
    onError?.(message);
  };

  const run = (mutation: () => Promise<MutationResult>) => {
    setError(undefined);
    startTransition(async () => {
      let result: MutationResult;
      try {
        result = await mutation();
      } catch (thrown) {
        // Redirects, notFound() and forbidden() are navigation, not failures.
        unstable_rethrow(thrown);
        console.error("[mutation] failed", errorSummary(thrown));
        fail(thrownMessage(thrown));
        return;
      }
      // Outside the try: the change is already saved, so a failing callback must not invite a second attempt.
      if (result?.error) {
        fail(result.error);
        return;
      }
      onSuccess?.();
      if (success) notify(success);
      if (refresh) router.refresh();
    });
  };

  return { run, pending, error, setError };
}
