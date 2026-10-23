import type { Metadata } from "next";
import { OnboardingForm } from "@/components/onboarding-form";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "New organization" };

export default function Page() {
  return (
    <div className="flex max-w-md flex-col gap-6">
      <PageHeader
        title="New organization"
        description="Organizations keep integrations, projects and members separate, for example one per client."
      />
      <OnboardingForm submitLabel="Create organization" />
    </div>
  );
}
