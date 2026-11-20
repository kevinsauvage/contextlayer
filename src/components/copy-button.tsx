"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Takes a path so the link uses whatever origin the admin is browsing on.
export function CopyLinkButton({
  path,
  label = "Copy link",
  fieldLabel = "Link",
}: {
  path: string;
  label?: string;
  // Names the fallback field shown when the clipboard refuses the copy.
  fieldLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [uncopied, setUncopied] = useState<string>();
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  async function copy() {
    const url = new URL(path, window.location.origin).toString();
    clearTimeout(resetTimer.current);
    // Cleared first so a second failure changes the live text again and is announced again.
    setUncopied(undefined);
    try {
      // `navigator.clipboard` is undefined on plain HTTP, so even accessing it throws inside the try, like a denied write.
      await navigator.clipboard.writeText(url);
      setUncopied(undefined);
      setCopied(true);
      resetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setUncopied(url);
    }
  }

  const status = copied ? "Copied" : uncopied ? "Copy failed; select the link below" : label;

  return (
    <span className="flex flex-col gap-1.5">
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {copied ? <Check /> : <Copy />}
        <span aria-live="polite">{status}</span>
      </Button>
      {uncopied && (
        <Input
          aria-label={fieldLabel}
          readOnly
          value={uncopied}
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          className="w-64 max-w-full"
        />
      )}
    </span>
  );
}
