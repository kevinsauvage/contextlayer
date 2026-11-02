// A signed-in member tried to do something reserved to organization owners and admins.
export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

// Another request already moved an analysis to `running`; starting it again would spend tokens twice.
export class AnalysisAlreadyRunningError extends Error {
  constructor() {
    super("Analysis already running");
    this.name = "AnalysisAlreadyRunningError";
  }
}

// The project points at an integration account that was deleted or disconnected since it was created.
export class ConnectionMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectionMissingError";
  }
}

// The tracker refused the write for a reason the person can fix (a summary that is too long, a required field).
export class TrackerRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrackerRejectedError";
  }
}

// The issue or project is gone, or the connected account cannot see it: retrying the same request cannot succeed.
export class TrackerNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrackerNotFoundError";
  }
}

// A logged failure keeps only what identifies it: the raw object can carry a request with its bearer token, or a whole
// prompt with source excerpts.
export const errorSummary = (error: unknown) =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);
