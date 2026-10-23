"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/infrastructure/auth/client";

export function SwitchAccountButton({ next }: { next: string }) {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await authClient.signOut();
        router.push(`/sign-in?next=${encodeURIComponent(next)}` as Route);
        router.refresh();
      }}
    >
      Sign in with another account
    </Button>
  );
}
