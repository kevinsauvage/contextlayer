"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { asRoute } from "@/components/as-route";
import { cn } from "@/lib/utils";

// The four sections of a project, as an underlined strip under its header.
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
    <nav aria-label="Project sections" className="flex gap-1 overflow-x-auto border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={asRoute(tab.href)}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition-colors",
            tab.active
              ? "border-brand font-medium text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
