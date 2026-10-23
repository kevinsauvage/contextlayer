"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/infrastructure/auth/client";
import { formString } from "@/lib/form";

const slugify = (name: string) =>
  `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-${Math.random().toString(36).slice(2, 6)}`;

export function OnboardingForm({ submitLabel = "Continue" }: { submitLabel?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const name = formString(formData, "name").trim();
    if (name.length < 2) {
      setError("Enter a name of at least 2 characters");
      return;
    }
    startTransition(async () => {
      const created = await authClient.organization.create({ name, slug: slugify(name) });
      if (created.error) {
        setError(created.error.message ?? "Could not create the organization");
        return;
      }
      await authClient.organization.setActive({ organizationId: created.data.id });
      router.push("/projects");
      router.refresh();
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
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : submitLabel}
      </Button>
    </form>
  );
}
