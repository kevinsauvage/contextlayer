"use client";

import { useRouter } from "next/navigation";
import { asRoute } from "@/components/as-route";
import { Button } from "@/components/ui/button";
import { notifyError } from "@/components/ui/toast";
import { useMutation } from "@/components/use-mutation";
import { authClient } from "@/infrastructure/auth/client";
import { textOr } from "@/lib/text";

export function SwitchAccountButton({ next }: { next: string }) {
  const router = useRouter();
  const { run, pending } = useMutation({ onError: notifyError });
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        run(async () => {
          const { error } = await authClient.signOut();
          if (error) return { error: textOr(error.message, "Could not switch account. Try again.") };
          router.push(asRoute(`/sign-in?next=${encodeURIComponent(next)}`));
          router.refresh();
          return {};
        })
      }
    >
      Sign in with another account
    </Button>
  );
}
