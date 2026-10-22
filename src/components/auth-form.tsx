"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/infrastructure/auth/client";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const signingUp = mode === "sign-up";

  function submit(formData: FormData) {
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));
    startTransition(async () => {
      const { error } = signingUp
        ? await authClient.signUp.email({ email, password, name: String(formData.get("name")) })
        : await authClient.signIn.email({ email, password });
      if (error) return setError(error.message ?? "Something went wrong");
      router.push("/projects");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      {signingUp && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" autoComplete="name" required />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" minLength={10} autoComplete={signingUp ? "new-password" : "current-password"} required />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>{signingUp ? "Create account" : "Sign in"}</Button>
      <p className="text-sm text-muted-foreground">
        {signingUp ? "Already have an account? " : "No account yet? "}
        <Link href={signingUp ? "/sign-in" : "/sign-up"} className="underline">{signingUp ? "Sign in" : "Sign up"}</Link>
      </p>
    </form>
  );
}
