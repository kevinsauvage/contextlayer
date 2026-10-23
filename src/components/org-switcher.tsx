"use client";

import { Check, ChevronsUpDown, Plus, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/infrastructure/auth/client";

type Organization = { id: string; name: string; role: string };

export function OrgSwitcher({ organizations, activeId }: { organizations: Organization[]; activeId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const active = organizations.find((org) => org.id === activeId);

  const switchTo = (organizationId: string) =>
    startTransition(async () => {
      await authClient.organization.setActive({ organizationId });
      router.push("/projects");
      router.refresh();
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="max-w-56 gap-2 px-2" aria-label="Switch organization" />}
        disabled={pending}
      >
        <span className="flex size-5 shrink-0 items-center justify-center rounded bg-primary text-[0.65rem] font-semibold text-primary-foreground">
          {active?.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="truncate">{active?.name ?? "Organization"}</span>
        <ChevronsUpDown className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Organizations</DropdownMenuLabel>
          {organizations.map((org) => (
            <DropdownMenuItem key={org.id} onClick={() => org.id !== activeId && switchTo(org.id)}>
              <span className="flex-1 truncate">{org.name}</span>
              {org.id === activeId && <Check aria-label="Current" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings/organization")}>
          <Settings /> Organization settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/organizations/new")}>
          <Plus /> New organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
