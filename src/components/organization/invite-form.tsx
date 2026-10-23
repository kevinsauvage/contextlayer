"use client";

import { useState } from "react";
import { CopyLinkButton } from "@/components/copy-button";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useMutation } from "@/components/use-mutation";
import { ADMIN_ROLE, MEMBER_ROLE, isInvitableRole } from "@/core/organizations/roles";
import { inviteMember } from "@/features/organizations/actions";
import { formString } from "@/lib/form";

export function InviteForm() {
  const [invitation, setInvitation] = useState<{ id: string; email: string }>();
  const { run, pending, error } = useMutation({ refresh: true });

  function submit(formData: FormData) {
    setInvitation(undefined);
    const email = formString(formData, "email").trim();
    const role = formString(formData, "role");
    run(async () => {
      const result = await inviteMember(email, isInvitableRole(role) ? role : MEMBER_ROLE);
      if (result.invitationId) setInvitation({ id: result.invitationId, email: result.email ?? email });
      return result;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <form action={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input id="invite-email" name="email" type="email" required placeholder="teammate@company.com" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-role">Role</Label>
          <NativeSelect id="invite-role" name="role" defaultValue={MEMBER_ROLE}>
            <NativeSelectOption value={MEMBER_ROLE}>Member: analyze and publish</NativeSelectOption>
            <NativeSelectOption value={ADMIN_ROLE}>Admin: also manage integrations</NativeSelectOption>
          </NativeSelect>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Inviting…" : "Create invite"}
        </Button>
      </form>
      <FormError error={error} />
      {invitation && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3 text-sm"
        >
          <span>Invitation for {invitation.email} created. Send them the link; it expires in 48 hours.</span>
          <CopyLinkButton path={`/invitations/${invitation.id}`} />
        </div>
      )}
    </div>
  );
}
