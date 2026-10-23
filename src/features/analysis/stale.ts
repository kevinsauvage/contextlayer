export const STALE_ANALYSIS_MS = 10 * 60 * 1000;
export const STALE_ANALYSIS_ERROR = "The analysis did not finish in time. Try again.";

// A killed request never reaches the run's catch block, so an old "running" row is treated as failed when read.
export const isStale = (row: { status: string; createdAt: Date }, now = Date.now()) =>
  row.status === "running" && row.createdAt.getTime() < now - STALE_ANALYSIS_MS;
