"use client";

import { useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { FormError } from "@/components/form-error";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation } from "@/components/use-mutation";
import { deleteOrganization, leaveOrganization } from "@/features/organizations/actions";

export function DangerZone({ organizationName, isOwner }: { organizationName: string; isOwner: boolean }) {
  return (
    <div className="flex flex-col divide-y">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div>
          <p className="font-medium">Leave this organization</p>
          <p className="text-sm text-muted-foreground">
            You lose access to its integrations, projects and analyses. The last owner cannot leave.
          </p>
        </div>
        <ConfirmButton
          trigger="Leave organization"
          triggerVariant="destructive"
          title={`Leave ${organizationName}?`}
          description="You will lose access to this organization and its analysis history."
          confirmLabel="Leave organization"
          pendingLabel="Leaving…"
          action={leaveOrganization}
        />
      </div>
      {isOwner && <DeleteOrganization organizationName={organizationName} />}
    </div>
  );
}

function DeleteOrganization({ organizationName }: { organizationName: string }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const { run, pending, error } = useMutation({ onSuccess: () => setOpen(false) });
  const matches = confirmation === organizationName;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmation("");
      }}
    >
      <AlertDialogTrigger render={<Button variant="destructive" />}>Delete organization</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {organizationName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the organization, its members, connections, projects and analysis history. It cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <label htmlFor="delete-organization-confirmation" className="text-sm">
            Type <span className="font-medium">{organizationName}</span> to confirm
          </label>
          <Input
            id="delete-organization-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            disabled={pending}
          />
        </div>
        <FormError error={error} />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={!matches || pending} onClick={() => run(deleteOrganization)}>
            {pending ? "Deleting…" : "Delete organization"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
