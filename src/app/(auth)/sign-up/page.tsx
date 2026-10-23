import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { CenteredShell } from "@/components/centered-shell";

export const metadata: Metadata = { title: "Create your account" };

export default async function Page({ searchParams }: PageProps<"/sign-up">) {
  const { next } = await searchParams;
  return (
    <CenteredShell title="Create your account" description="Then connect a repository and a ticket project.">
      <AuthForm mode="sign-up" next={typeof next === "string" ? next : undefined} />
    </CenteredShell>
  );
}
