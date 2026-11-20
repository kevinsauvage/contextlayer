// Auth clients may return an empty message; a blank one must fall back like a missing one, or it reads as success.
export const textOr = (text: string | null | undefined, fallback: string): string => (text?.trim() ? text : fallback);
