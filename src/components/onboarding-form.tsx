"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/infrastructure/auth/client";

const slugify = (name: string) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Math.random().toString(36).slice(2, 6)}`;

export function OnboardingForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const name = String(formData.get("name")).trim();
    startTransition(async () => {
      const created = await authClient.organization.create({ name, slug: slugify(name) });
      if (created.error || !created.data) return setError(created.error?.message ?? "Could not create the organization");
      await authClient.organization.setActive({ organizationId: created.data.id });
      router.push("/settings/integrations");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      <Input name="name" placeholder="Acme Agency" aria-label="Organization name" required />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>Continue</Button>
    </form>
  );
}
