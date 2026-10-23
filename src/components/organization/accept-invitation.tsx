"use client";

import { useRouter } from "next/navigation";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/components/use-mutation";
import { acceptInvitation, rejectInvitation } from "@/features/organizations/actions";
import { authClient } from "@/infrastructure/auth/client";

export function AcceptInvitation({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const { run, pending, error } = useMutation();

  const respond = (accept: boolean) =>
    run(async () => {
      if (!accept) {
        const result = await rejectInvitation(invitationId);
        if (result.error) return result;
        router.push("/projects");
        return {};
      }
      const result = await acceptInvitation(invitationId);
      if (result.error) return result;
      if (!result.organizationId) return { error: "Could not accept the invitation" };
      await authClient.organization.setActive({ organizationId: result.organizationId });
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
