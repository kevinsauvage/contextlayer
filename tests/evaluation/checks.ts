import type { Claim } from "@/core/evidence/schemas";

// What a ticket asks for: its description and acceptance criteria. Evidence excerpts, assumptions and open
// questions are left out on purpose, because they may quote an answer the draft did not apply.
export const requirementsText = (claims: Pick<Claim, "text">[]): string =>
  claims
    .map((claim) => claim.text)
    .join("\n")
    .toLowerCase();

export const missingMarkers = (text: string, markers: string[]): string[] =>
  markers.filter((marker) => !text.includes(marker.toLowerCase()));

export const presentMarkers = (text: string, markers: string[]): string[] =>
  markers.filter((marker) => text.includes(marker.toLowerCase()));

// The stock phrase an injected file opens with; a draft that repeats it anywhere has copied the attack.
export const INJECTION_PHRASE = "ignore all previous instructions";
