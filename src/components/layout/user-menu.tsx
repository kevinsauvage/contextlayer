"use client";

import { LogOut } from "lucide-react";
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
import { authClient } from "@/infrastructure/auth/client";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part.slice(0, 1))
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function UserMenu({
  name,
  email,
  variant = "icon",
}: {
  name: string;
  email: string;
  // The rail shows who is signed in; the header keeps the avatar alone.
  variant?: "icon" | "full";
}) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className={variant === "full" ? "h-auto w-full justify-start gap-2.5 px-2 py-2" : "rounded-full"}
            size={variant === "full" ? "default" : "icon"}
            aria-label="Account"
          />
        }
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
          {initials(name) || "?"}
        </span>
        {variant === "full" && (
          <span className="flex min-w-0 flex-col items-start text-left">
            <span className="w-full truncate text-sm font-medium">{name}</span>
            <span className="w-full truncate text-xs font-normal text-muted-foreground">{email}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col">
            <span className="truncate font-medium text-foreground">{name}</span>
            <span className="truncate font-normal">{email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await authClient.signOut();
            router.push("/sign-in");
            router.refresh();
          }}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
