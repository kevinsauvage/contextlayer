// A redirect cannot carry a message, so the destination's URL names one of these and `FlashToast` shows it once.
// Only keys travel in the URL: a crafted link can pick a message from this list but never write its own.
export const FLASH_PARAM = "notice";

export const FLASH_MESSAGES = {
  project_created: "Project created. Describe what you need to draft your first ticket.",
  project_deleted: "Project deleted.",
  organization_left: "You left the organization.",
  organization_deleted: "Organization deleted.",
} as const;

export type FlashKey = keyof typeof FLASH_MESSAGES;

export const isFlashKey = (value: string | null): value is FlashKey =>
  value !== null && Object.hasOwn(FLASH_MESSAGES, value);

export const withFlash = (path: string, key: FlashKey) =>
  `${path}${path.includes("?") ? "&" : "?"}${FLASH_PARAM}=${key}`;
