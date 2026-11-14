import "server-only";
import {
  AnalysisAlreadyRunningError,
  AnalysisLimitError,
  ConnectionMissingError,
  ForbiddenError,
  ReconnectRequiredError,
  TrackerNotFoundError,
  TrackerRejectedError,
} from "@/core/errors";
import type { ActionState } from "@/lib/action-state";

export function toActionError(error: unknown): { error: string } | null {
  if (error instanceof ForbiddenError)
    return { error: "Only organization owners and admins can do this. Ask one of them." };
  if (error instanceof AnalysisAlreadyRunningError)
    return { error: "This analysis is already running. Wait for it to finish." };
  if (error instanceof AnalysisLimitError) return { error: error.message };
  if (error instanceof ReconnectRequiredError)
    return { error: `${error.message} An admin needs to reconnect it in Integrations.` };
  if (error instanceof TrackerRejectedError) return { error: error.message };
  if (error instanceof TrackerNotFoundError) return { error: error.message };
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
