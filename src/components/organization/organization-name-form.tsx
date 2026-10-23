"use client";

import { useState } from "react";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@/components/use-mutation";
import { renameOrganization } from "@/features/organizations/actions";
import { formString } from "@/lib/form";

export function OrganizationNameForm({ name, canEdit }: { name: string; canEdit: boolean }) {
  const [saved, setSaved] = useState(false);
  const { run, pending, error, setError } = useMutation({ refresh: true, onSuccess: () => setSaved(true) });

  function submit(formData: FormData) {
    setSaved(false);
    const next = formString(formData, "name").trim();
    if (next.length < 2) {
      setError("Enter a name of at least 2 characters");
      return;
    }
    run(() => renameOrganization(next));
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
      <FormError error={error} />
      {saved && (
        <p role="status" className="text-sm text-muted-foreground">
          Saved.
        </p>
      )}
    </form>
  );
}
