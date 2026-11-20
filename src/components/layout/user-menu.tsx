"use client";

import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { notifyError } from "@/components/ui/toast";
import { useMutation } from "@/components/use-mutation";
import { authClient } from "@/infrastructure/auth/client";
import { textOr } from "@/lib/text";

const THEMES = [
  { value: "system", label: "System", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
] as const;

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
  const { theme = "system", setTheme } = useTheme();
  const { run, pending } = useMutation({ onError: notifyError });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className={variant === "full" ? "h-auto w-full justify-start gap-2.5 px-2 py-2" : "rounded-full"}
            size={variant === "full" ? "default" : "icon"}
            aria-label={`${name}, account`}
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
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={(value: string) => setTheme(value)}>
            {THEMES.map(({ value, label, Icon }) => (
              <DropdownMenuRadioItem key={value} value={value}>
                <Icon /> {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onClick={() =>
            run(async () => {
              const { error } = await authClient.signOut();
              if (error) return { error: textOr(error.message, "Could not sign you out. Try again.") };
              router.push("/sign-in");
              router.refresh();
              return {};
            })
          }
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
