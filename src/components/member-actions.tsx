"use client";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/components/use-mutation";
import { authClient } from "@/infrastructure/auth/client";

type Props = { label: string; pendingLabel: string; action: () => Promise<{ error: { message?: string } | null }> };

function MemberAction({ label, pendingLabel, action }: Props) {
  const { run, pending, error } = useMutation({ refresh: true });
  return (
    <span className="flex items-center gap-2">
      <FormError error={error} className="text-xs" />
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          run(async () => {
            const { error } = await action();
            return error ? { error: error.message ?? "Something went wrong" } : {};
          })
        }
      >
        {pending ? pendingLabel : label}
      </Button>
    </span>
  );
}

export const RemoveMemberButton = ({ memberId }: { memberId: string }) => (
  <MemberAction
    label="Remove"
    pendingLabel="Removing…"
    action={() => authClient.organization.removeMember({ memberIdOrEmail: memberId })}
  />
);

export const CancelInvitationButton = ({ invitationId }: { invitationId: string }) => (
  <MemberAction
    label="Revoke"
    pendingLabel="Revoking…"
    action={() => authClient.organization.cancelInvitation({ invitationId })}
  />
);
