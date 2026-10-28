"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { asRoute } from "@/components/as-route";

// The four things a project does, as a left rail on wide screens and a scrollable strip on phones.
export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const tabs = [
    { href: base, label: "Draft" },
    { href: `${base}/audit`, label: "Audit" },
    { href: `${base}/history`, label: "History" },
    { href: `${base}/settings`, label: "Settings" },
  ].map((tab) => ({ ...tab, active: pathname === tab.href }));

  return (
    <nav
      aria-label="Ticket work"
      className="flex gap-1 overflow-x-auto rounded-lg border p-1 md:w-full md:flex-col md:overflow-visible"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={asRoute(tab.href)}
          aria-current={tab.active ? "page" : undefined}
          className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
            tab.active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
