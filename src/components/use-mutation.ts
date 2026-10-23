"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type MutationOptions = {
  // Refresh the current route after success so server-rendered data catches up.
  refresh?: boolean;
  onSuccess?: () => void;
};

type MutationResult = { error?: string } | undefined;

// Runs one client-side mutation and reports its error; a returned `error` keeps it on screen.
export function useMutation({ refresh = false, onSuccess }: MutationOptions = {}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const run = (mutation: () => Promise<MutationResult>) => {
    setError(undefined);
    startTransition(async () => {
      const result = await mutation();
      if (result?.error) {
        setError(result.error);
        return;
      }
      onSuccess?.();
      if (refresh) router.refresh();
    });
  };

  return { run, pending, error, setError };
}
