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
