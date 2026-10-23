"use client";

import { useRouter } from "next/navigation";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@/components/use-mutation";
import { createOrganization } from "@/features/organizations/actions";
import { authClient } from "@/infrastructure/auth/client";
import { formString } from "@/lib/form";

export function OnboardingForm({ submitLabel = "Continue" }: { submitLabel?: string }) {
  const router = useRouter();
  const { run, pending, error, setError } = useMutation();

  function submit(formData: FormData) {
    const name = formString(formData, "name").trim();
    if (name.length < 2) {
      setError("Enter a name of at least 2 characters");
      return;
    }
    run(async () => {
      const created = await createOrganization(name);
      if (created.error) return created;
      if (!created.organizationId) return { error: "Could not create the organization" };
      await authClient.organization.setActive({ organizationId: created.organizationId });
      router.push("/projects");
      router.refresh();
      return {};
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="org-name">Organization name</Label>
        <Input
          id="org-name"
          name="name"
          placeholder="Acme Agency"
          required
          minLength={2}
          maxLength={100}
          autoFocus
          aria-invalid={Boolean(error)}
        />
        <p className="text-xs text-muted-foreground">Usually your company or team. You can rename it later.</p>
      </div>
      <FormError error={error} />
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : submitLabel}
      </Button>
    </form>
  );
}
