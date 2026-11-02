import Link from "next/link";
import { FolderKanban, Plug, Settings2 } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { NavLink } from "@/components/layout/nav-link";
import { SideNavLink } from "@/components/layout/side-nav-link";
import { OrgSwitcher } from "@/components/organization/org-switcher";
import { UserMenu } from "@/components/layout/user-menu";
import { listUserOrganizations } from "@/features/organizations/queries";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";

const NAV = [
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/settings/integrations", label: "Integrations", icon: Plug },
  { href: "/settings/organization", label: "Organization", icon: Settings2 },
] as const;

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
      <div className="min-h-svh bg-muted/25">
        <div className="mx-auto flex min-h-svh w-full max-w-[1440px] bg-background">
          <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-6 border-r bg-muted/25 px-3 py-4 md:flex xl:w-64">
            <Link href="/projects" aria-label="ContextLayer home" className="w-fit rounded-md px-1.5">
              <Logo />
            </Link>
            <OrgSwitcher organizations={organizations} activeId={organizationId} className="w-full justify-start" />
            <nav aria-label="Main" className="flex flex-col gap-0.5">
              {NAV.map(({ href, label, icon: Icon }) => (
                <SideNavLink key={href} href={href} icon={<Icon aria-hidden className="size-4 shrink-0" />}>
                  {label}
                </SideNavLink>
              ))}
            </nav>
            <div className="mt-auto border-t pt-3">
              <UserMenu name={user.name} email={user.email} variant="full" />
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Phones get the same links in a compact top bar. */}
            <header className="sticky top-0 z-40 border-b bg-card/85 backdrop-blur-md md:hidden">
              <div className="flex h-14 items-center gap-2 px-4">
                <Link href="/projects" aria-label="ContextLayer home" className="mr-1 rounded-md">
                  <Logo />
                </Link>
                <span aria-hidden className="text-muted-foreground/40">
                  /
                </span>
                <OrgSwitcher organizations={organizations} activeId={organizationId} />
                <div className="ml-auto">
                  <UserMenu name={user.name} email={user.email} />
                </div>
              </div>
              <nav aria-label="Main" className="flex h-10 items-stretch gap-1 border-t px-2">
                {NAV.map(({ href, label }) => (
                  <NavLink key={href} href={href}>
                    {label}
                  </NavLink>
                ))}
              </nav>
            </header>

            <main id="main" className="w-full max-w-[1280px] flex-1 px-4 pt-8 pb-16 md:px-8 md:pt-10 xl:px-10">
              {children}
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
