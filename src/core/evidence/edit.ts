import type { Claim } from "@/core/evidence/schemas";

// The evidence supported the generated wording, not the reviewer's; only the reviewer can vouch for the new text.
export function withEditedText<T extends Claim>(claim: T, text: string): T {
  if (text === claim.text) return claim;
  return { ...claim, text, status: claim.status === "verified" ? "inferred" : claim.status };
}
