"use client";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/components/use-mutation";
import { cancelInvitation, removeMember } from "@/features/organizations/actions";
import type { ActionState } from "@/lib/action-state";

type Props = { label: string; pendingLabel: string; success: string; action: () => Promise<ActionState> };

function MemberAction({ label, pendingLabel, success, action }: Props) {
  const { run, pending, error } = useMutation({ refresh: true, success });
  return (
    <span className="flex items-center gap-2">
      <FormError error={error} className="text-xs" />
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(action)}>
        {pending ? pendingLabel : label}
      </Button>
    </span>
  );
}

export const RemoveMemberButton = ({ memberId }: { memberId: string }) => (
  <MemberAction
    label="Remove"
    pendingLabel="Removing…"
    success="Member removed."
    action={() => removeMember(memberId)}
  />
);

export const CancelInvitationButton = ({ invitationId }: { invitationId: string }) => (
  <MemberAction
    label="Revoke"
    pendingLabel="Revoking…"
    success="Invitation revoked."
    action={() => cancelInvitation(invitationId)}
  />
);
