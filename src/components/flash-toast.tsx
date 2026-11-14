"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { notify } from "@/components/ui/toast";
import { FLASH_MESSAGES, FLASH_PARAM, isFlashKey } from "@/lib/flash";

// Shows the message a redirect left in the URL, then drops the parameter so a reload does not repeat it.
export function FlashToast() {
  const pathname = usePathname();
  const params = useSearchParams();
  const key = params.get(FLASH_PARAM);

  useEffect(() => {
    if (!isFlashKey(key)) return;
    notify(FLASH_MESSAGES[key]);
    const rest = new URLSearchParams(params);
    rest.delete(FLASH_PARAM);
    const query = rest.toString();
    window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}`);
  }, [key, params, pathname]);

  return null;
}
