import type { Route } from "next";
import { redirect } from "next/navigation";
import { withFlash, type FlashKey } from "@/lib/flash";

// Redirects and leaves a confirmation for the destination to show once.
export function redirectWithFlash(path: string, key: FlashKey): never {
  redirect(withFlash(path, key) as Route);
}
