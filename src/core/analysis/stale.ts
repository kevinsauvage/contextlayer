export const STALE_ANALYSIS_MS = 10 * 60 * 1000;
export const STALE_ANALYSIS_ERROR = "The analysis did not finish in time. Try again.";

// A publish claim is one tracker request, not a long job: an older claim belongs to a request that died.
export const PUBLISH_CLAIM_MS = 2 * 60 * 1000;

// A killed request never reaches the run's catch block, so an old "running" row is treated as failed when read.
export const isStale = (row: { status: string; startedAt: Date }, now = Date.now()) =>
  row.status === "running" && row.startedAt.getTime() < now - STALE_ANALYSIS_MS;
