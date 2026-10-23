"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/infrastructure/auth/client";
import { formString } from "@/lib/form";

export function OrganizationNameForm({ name, canEdit }: { name: string; canEdit: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ error?: string; saved?: boolean }>({});
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const next = formString(formData, "name").trim();
    if (next.length < 2) {
      setMessage({ error: "Enter a name of at least 2 characters" });
      return;
    }
    startTransition(async () => {
      const { error } = await authClient.organization.update({ data: { name: next } });
      setMessage(error ? { error: error.message ?? "Could not rename the organization" } : { saved: true });
      router.refresh();
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-2">
      <Label htmlFor="organization-name">Name</Label>
      <div className="flex gap-2">
        <Input id="organization-name" name="name" defaultValue={name} disabled={!canEdit || pending} maxLength={100} />
        {canEdit && (
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        )}
      </div>
      {message.error && (
        <p role="alert" className="text-sm text-destructive">
          {message.error}
        </p>
      )}
      {message.saved && (
        <p role="status" className="text-sm text-muted-foreground">
          Saved.
        </p>
      )}
    </form>
  );
}
