import "server-only";
import { AnalysisAlreadyRunningError, ConnectionMissingError, ForbiddenError } from "@/core/errors";
import { ReconnectRequiredError } from "@/core/integrations/provider";
import type { ActionState } from "@/lib/action-state";

export function toActionError(error: unknown): { error: string } | null {
  if (error instanceof ForbiddenError) return { error: "Only organization owners and admins can do this" };
  if (error instanceof AnalysisAlreadyRunningError) return { error: "This analysis is already running" };
  if (error instanceof ReconnectRequiredError)
    return { error: `${error.message} An admin needs to reconnect it in Integrations.` };
  if (error instanceof ConnectionMissingError) return { error: error.message };
  return null;
}

// Unknown errors (including Next.js redirects) keep propagating to the boundary.
export async function withActionErrors<T extends ActionState>(run: () => Promise<T>): Promise<T | ActionState> {
  try {
    return await run();
  } catch (error) {
    const mapped = toActionError(error);
    if (mapped) return mapped;
    throw error;
  }
}
