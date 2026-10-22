import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { requireOrgContext } from "@/infrastructure/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireOrgContext();
  return (
    <>
      <header className="border-b">
        <nav className="mx-auto flex max-w-4xl items-center gap-6 px-4 py-3 text-sm">
          <Link href="/projects" className="font-semibold">ContextLayer</Link>
          <Link href="/projects" className="text-muted-foreground hover:text-foreground">Projects</Link>
          <Link href="/settings/integrations" className="text-muted-foreground hover:text-foreground">Integrations</Link>
          <div className="ml-auto"><SignOutButton /></div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
