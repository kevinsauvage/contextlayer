"use client";

import { useRouter } from "next/navigation";
import { asRoute } from "@/components/as-route";
import { Button } from "@/components/ui/button";
import { authClient } from "@/infrastructure/auth/client";

export function SwitchAccountButton({ next }: { next: string }) {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await authClient.signOut();
        router.push(asRoute(`/sign-in?next=${encodeURIComponent(next)}`));
        router.refresh();
      }}
    >
      Sign in with another account
    </Button>
  );
}
