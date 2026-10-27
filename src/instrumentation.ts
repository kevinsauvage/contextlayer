// Validates configuration when the server starts, so a missing or malformed variable fails at boot instead of on
// the first request that happens to read it.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getEnv } = await import("@/infrastructure/env");
  getEnv();
}
