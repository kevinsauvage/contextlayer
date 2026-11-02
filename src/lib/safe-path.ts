// Only same-origin paths: an absolute or protocol-relative URL would be an open redirect. The URL parser drops tabs and
// newlines, so `/\t/evil.com` would otherwise look like a path and resolve off-site.
const ORIGIN = "http://n";

export function safePath(value: string | null | undefined, fallback: string): string {
  if (!value?.startsWith("/")) return fallback;
  try {
    const url = new URL(value, ORIGIN);
    return url.origin === ORIGIN ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
