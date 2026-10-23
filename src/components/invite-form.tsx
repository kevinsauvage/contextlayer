"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CopyLinkButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/infrastructure/auth/client";
import { formString } from "@/lib/form";

const ROLES = ["member", "admin"] as const;
type Role = (typeof ROLES)[number];
const isRole = (value: string): value is Role => (ROLES as readonly string[]).includes(value);

export function InviteForm() {
  const router = useRouter();
  const [state, setState] = useState<{ error?: string; invitationId?: string; email?: string }>({});
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const email = formString(formData, "email").trim();
    const role = formString(formData, "role");
    startTransition(async () => {
      const { data, error } = await authClient.organization.inviteMember({
        email,
        role: isRole(role) ? role : "member",
      });
      if (error) {
        setState({ error: error.message ?? "Could not create the invitation" });
        return;
      }
      setState({ invitationId: data.id, email });
      router.refresh();
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
          <select
            id="invite-role"
            name="role"
            defaultValue="member"
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="member">Member: analyze and publish</option>
            <option value="admin">Admin: also manage integrations</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Inviting…" : "Create invite"}
        </Button>
      </form>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.invitationId && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3 text-sm"
        >
          <span>Invitation for {state.email} created. Send them the link; it expires in 48 hours.</span>
          <CopyLinkButton path={`/invitations/${state.invitationId}`} />
        </div>
      )}
    </div>
  );
}
