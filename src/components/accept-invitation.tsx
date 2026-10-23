"use client";

import { useRouter } from "next/navigation";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/components/use-mutation";
import { authClient } from "@/infrastructure/auth/client";

export function AcceptInvitation({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const { run, pending, error } = useMutation();

  const respond = (accept: boolean) =>
    run(async () => {
      if (!accept) {
        const { error } = await authClient.organization.rejectInvitation({ invitationId });
        if (error) return { error: error.message ?? "Could not decline the invitation" };
        router.push("/projects");
        return {};
      }
      const { data, error } = await authClient.organization.acceptInvitation({ invitationId });
      if (error) return { error: error.message ?? "Could not accept the invitation" };
      await authClient.organization.setActive({ organizationId: data.invitation.organizationId });
      router.push("/projects");
      router.refresh();
      return {};
    });

  return (
    <div className="flex flex-col gap-3">
      <FormError error={error} />
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
