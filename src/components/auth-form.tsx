"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@/components/use-mutation";
import { authClient } from "@/infrastructure/auth/client";
import { formString } from "@/lib/form";
import { safePath } from "@/lib/safe-path";

export function AuthForm({ mode, next }: { mode: "sign-in" | "sign-up"; next?: string }) {
  const router = useRouter();
  const { run, pending, error } = useMutation();
  const signingUp = mode === "sign-up";
  const destination = safePath(next, "/projects") as Route;
  const otherMode = `${signingUp ? "/sign-in" : "/sign-up"}${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  function submit(formData: FormData) {
    const email = formString(formData, "email");
    const password = formString(formData, "password");
    run(async () => {
      const { error } = signingUp
        ? await authClient.signUp.email({ email, password, name: formString(formData, "name") })
        : await authClient.signIn.email({ email, password });
      if (error) return { error: error.message ?? "Something went wrong" };
      router.push(destination);
      router.refresh();
      return {};
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      {signingUp && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" autoComplete="name" required autoFocus />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus={!signingUp} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          minLength={10}
          autoComplete={signingUp ? "new-password" : "current-password"}
          aria-describedby={signingUp ? "password-hint" : undefined}
          required
        />
        {signingUp && (
          <p id="password-hint" className="text-xs text-muted-foreground">
            At least 10 characters.
          </p>
        )}
      </div>
      <FormError error={error} />
      <Button type="submit" disabled={pending}>
        {pending ? "Please wait…" : signingUp ? "Create account" : "Sign in"}
      </Button>
      <p className="text-sm text-muted-foreground">
        {signingUp ? "Already have an account? " : "No account yet? "}
        <Link href={otherMode as Route} className="underline">
          {signingUp ? "Sign in" : "Sign up"}
        </Link>
      </p>
    </form>
  );
}
