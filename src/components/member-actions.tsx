"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/infrastructure/auth/client";

type Props = { label: string; pendingLabel: string; run: () => Promise<{ error: { message?: string } | null }> };

function AsyncButton({ label, pendingLabel, run }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <span className="flex items-center gap-2">
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const { error } = await run();
            if (error) setError(error.message ?? "Something went wrong");
            else router.refresh();
          })
        }
      >
        {pending ? pendingLabel : label}
      </Button>
    </span>
  );
}

export const RemoveMemberButton = ({ memberId }: { memberId: string }) => (
  <AsyncButton
    label="Remove"
    pendingLabel="Removing…"
    run={() => authClient.organization.removeMember({ memberIdOrEmail: memberId })}
  />
);

export const CancelInvitationButton = ({ invitationId }: { invitationId: string }) => (
  <AsyncButton
    label="Revoke"
    pendingLabel="Revoking…"
    run={() => authClient.organization.cancelInvitation({ invitationId })}
  />
);
