"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/infrastructure/auth/client";

export function AcceptInvitation({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const respond = (accept: boolean) =>
    startTransition(async () => {
      if (!accept) {
        const { error } = await authClient.organization.rejectInvitation({ invitationId });
        if (error) setError(error.message ?? "Could not decline the invitation");
        else router.push("/projects");
        return;
      }
      const { data, error } = await authClient.organization.acceptInvitation({ invitationId });
      if (error) {
        setError(error.message ?? "Could not accept the invitation");
        return;
      }
      await authClient.organization.setActive({ organizationId: data.invitation.organizationId });
      router.push("/projects");
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button disabled={pending} onClick={() => respond(true)}>
          {pending ? "Joining…" : "Accept and join"}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => respond(false)}>
          Decline
        </Button>
      </div>
    </div>
  );
}
