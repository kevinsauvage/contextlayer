"use client";

import { useState } from "react";
import { FormError } from "@/components/form-error";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/components/use-mutation";
import type { ActionState } from "@/lib/action-state";

type Props = {
  trigger: React.ReactNode;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
  triggerSize?: React.ComponentProps<typeof Button>["size"];
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  action: () => Promise<ActionState>;
};

export function ConfirmButton({
  trigger,
  triggerVariant,
  triggerSize,
  title,
  description,
  confirmLabel,
  pendingLabel,
  action,
}: Props) {
  const [open, setOpen] = useState(false);
  const { run, pending, error } = useMutation({ onSuccess: () => setOpen(false) });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant={triggerVariant} size={triggerSize} />}>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <FormError error={error} />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={() => run(action)}>
            {pending ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
