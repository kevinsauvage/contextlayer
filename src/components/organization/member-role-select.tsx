"use client";

import { FormError } from "@/components/form-error";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useMutation } from "@/components/use-mutation";
import { ADMIN_ROLE, MEMBER_ROLE } from "@/core/organizations/roles";
import { updateMemberRole } from "@/features/organizations/actions";

export function MemberRoleSelect({ memberId, role, disabled }: { memberId: string; role: string; disabled?: boolean }) {
  const { run, pending, error } = useMutation({ refresh: true });
  return (
    <span className="flex items-center gap-2">
      <NativeSelect
        value={role}
        disabled={pending ? true : Boolean(disabled)}
        aria-label="Member role"
        onChange={(event) => run(() => updateMemberRole(memberId, event.target.value))}
      >
        <NativeSelectOption value={MEMBER_ROLE}>Member</NativeSelectOption>
        <NativeSelectOption value={ADMIN_ROLE}>Admin</NativeSelectOption>
      </NativeSelect>
      <FormError error={error} className="text-xs" />
    </span>
  );
}
