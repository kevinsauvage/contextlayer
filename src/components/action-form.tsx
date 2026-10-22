"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/features/ticket-creation/actions";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  name: string;
  label: string;
  placeholder: string;
  submitLabel: string;
  pendingLabel: string;
};

export function ActionForm({ action, name, label, placeholder, submitLabel, pendingLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <div className="flex gap-2">
        <Input id={name} name={name} placeholder={placeholder} required disabled={pending} aria-invalid={Boolean(state.error)} />
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
