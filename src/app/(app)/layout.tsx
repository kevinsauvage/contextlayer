import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { NavLink } from "@/components/layout/nav-link";
import { OrgSwitcher } from "@/components/organization/org-switcher";
import { UserMenu } from "@/components/layout/user-menu";
import { listUserOrganizations } from "@/features/organizations/queries";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { userId, organizationId, user } = await requireOrgContext();
  const organizations = await listUserOrganizations(getDb(), userId);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b bg-card/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <Link href="/projects" aria-label="ContextLayer home" className="mr-1 rounded-md">
            <Logo />
          </Link>
          <span aria-hidden className="text-muted-foreground/40">
            /
          </span>
          <OrgSwitcher organizations={organizations} activeId={organizationId} />
          <nav aria-label="Main" className="ml-4 hidden h-full items-stretch gap-1 sm:flex">
            <NavLink href="/projects">Projects</NavLink>
            <NavLink href="/settings/integrations">Integrations</NavLink>
            <NavLink href="/settings/organization">Settings</NavLink>
          </nav>
          <div className="ml-auto">
            <UserMenu name={user.name} email={user.email} />
          </div>
        </div>
        <nav aria-label="Main" className="mx-auto flex h-10 max-w-5xl items-stretch gap-1 px-2 sm:hidden">
          <NavLink href="/projects">Projects</NavLink>
          <NavLink href="/settings/integrations">Integrations</NavLink>
          <NavLink href="/settings/organization">Settings</NavLink>
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-10 pb-16">
        {children}
      </main>
    </>
  );
}
