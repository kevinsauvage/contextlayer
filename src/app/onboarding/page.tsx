import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { getSession } from "@/infrastructure/auth/session";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (session.session.activeOrganizationId) redirect("/projects");
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Name your organization</h1>
        <p className="text-sm text-muted-foreground">Your team, projects and integrations live here.</p>
      </div>
      <OnboardingForm />
    </main>
  );
}
