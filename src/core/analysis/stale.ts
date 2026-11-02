// The analysis pages allow `maxDuration = 300` s. A run stops its model calls before that, so it can still record its
// own failure instead of being killed by the host with the row left "running".
export const RUN_BUDGET_MS = 270 * 1000;
export const RUN_TIMEOUT_ERROR = "The analysis took too long and was stopped. Try again.";

// Past the host limit plus a margin, a "running" row has no request left to finish it.
export const STALE_ANALYSIS_MS = 6 * 60 * 1000;
export const STALE_ANALYSIS_ERROR = "The analysis did not finish in time. Try again.";

// A publish claim is one tracker request, not a long job: an older claim belongs to a request that died.
export const PUBLISH_CLAIM_MS = 2 * 60 * 1000;

// A killed request never reaches the run's catch block, so an old "running" row is treated as failed when read.
export const isStale = (row: { status: string; startedAt: Date }, now = Date.now()) =>
  row.status === "running" && row.startedAt.getTime() < now - STALE_ANALYSIS_MS;
