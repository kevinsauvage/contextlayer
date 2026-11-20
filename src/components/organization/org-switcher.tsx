"use client";

import { Check, ChevronsUpDown, Plus, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { notifyError } from "@/components/ui/toast";
import { useMutation } from "@/components/use-mutation";
import { authClient } from "@/infrastructure/auth/client";
import { textOr } from "@/lib/text";

type Organization = { id: string; name: string; role: string };

export function OrgSwitcher({
  organizations,
  activeId,
  className,
}: {
  organizations: Organization[];
  activeId: string;
  className?: string;
}) {
  const router = useRouter();
  const { run, pending } = useMutation({
    onSuccess: () => router.push("/projects"),
    onError: notifyError,
    refresh: true,
  });
  const active = organizations.find((org) => org.id === activeId);

  const switchTo = (organizationId: string) =>
    run(async () => {
      const { error } = await authClient.organization.setActive({ organizationId });
      return error ? { error: textOr(error.message, "Could not switch organization. Try again.") } : {};
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className={`max-w-56 justify-start gap-2 px-2 ${className ?? ""}`}
            aria-label={`${active?.name ?? "Organization"}, switch organization`}
          />
        }
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
