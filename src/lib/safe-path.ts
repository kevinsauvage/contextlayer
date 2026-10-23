// Only same-origin paths: an absolute or protocol-relative URL would be an open redirect.
export const safePath = (value: string | null | undefined, fallback: string) =>
  value && /^\/(?![/\\])/.test(value) ? value : fallback;
