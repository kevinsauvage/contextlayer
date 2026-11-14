"use client";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@/components/use-mutation";
import { organizationNameSchema } from "@/core/organizations/schemas";
import { renameOrganization } from "@/features/organizations/actions";
import { formString } from "@/lib/form";
import { firstIssueMessage } from "@/lib/zod";

export function OrganizationNameForm({ name, canEdit }: { name: string; canEdit: boolean }) {
  const { run, pending, error, setError } = useMutation({ refresh: true, success: "Organization renamed." });

  function submit(formData: FormData) {
    const parsed = organizationNameSchema.safeParse(formString(formData, "name"));
    if (!parsed.success) {
      setError(firstIssueMessage(parsed.error));
      return;
    }
    run(() => renameOrganization(parsed.data));
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
    </form>
  );
}
