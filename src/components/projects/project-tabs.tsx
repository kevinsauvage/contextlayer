"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { asRoute } from "@/components/as-route";

// Navigation between the two things a project does: draft a new ticket, or audit an existing one.
export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const tabs = [
    {
      href: `/projects/${projectId}`,
      label: "Draft",
      active: !pathname.endsWith("/audit") && !pathname.endsWith("/history"),
    },
    { href: `/projects/${projectId}/audit`, label: "Audit", active: pathname.endsWith("/audit") },
    { href: `/projects/${projectId}/history`, label: "History", active: pathname.endsWith("/history") },
  ];

  return (
    <nav aria-label="Ticket work" className="inline-flex w-fit items-center gap-1 rounded-lg border p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={asRoute(tab.href)}
          aria-current={tab.active ? "page" : undefined}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab.active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
