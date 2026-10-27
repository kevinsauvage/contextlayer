import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ConnectNotice } from "@/components/integrations/connect-notice";
import { PageHeader } from "@/components/page-header";
import { ProjectFormSkeleton } from "@/components/projects/project-form-skeleton";
import { integrationsOverview, ofKind, providerNames } from "@/features/integrations/overview";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";
import { ProjectFormSection } from "./project-form-section";

export const metadata: Metadata = { title: "New project" };

export default async function Page({ searchParams }: PageProps<"/projects/new">) {
  const { organizationId, isAdmin } = await requireOrgContext();
  if (!isAdmin) {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <PageHeader title="New project" description="Only organization owners and admins can create projects." />
        <Link href="/projects" className="text-sm underline">
          Back to projects
        </Link>
      </div>
    );
  }
  const [overview, params] = await Promise.all([integrationsOverview(getDb(), organizationId), searchParams]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        breadcrumb={<Link href="/projects">Projects</Link>}
        title="New project"
        description="A project pairs one repository with one issue tracker project. Analyses use both."
      />
      <ConnectNotice params={params} providerNames={providerNames(overview)} />
      <Suspense fallback={<ProjectFormSkeleton />}>
        <ProjectFormSection
          organizationId={organizationId}
          sources={ofKind(overview, "source")}
          trackers={ofKind(overview, "tracker")}
        />
      </Suspense>
    </div>
  );
}
