import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { CenteredShell } from "@/components/layout/centered-shell";

export const metadata: Metadata = { title: "Sign in" };

export default async function Page({ searchParams }: PageProps<"/sign-in">) {
  const { next } = await searchParams;
  return (
    <CenteredShell title="Sign in" description="Evidence-backed tickets from your code.">
      <AuthForm mode="sign-in" next={typeof next === "string" ? next : undefined} />
    </CenteredShell>
  );
}
