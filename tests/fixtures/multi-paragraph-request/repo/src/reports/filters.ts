export type ReportFilters = { from?: string; to?: string; status?: string };

export const filters = [
  { id: "from", label: "From", kind: "date" },
  { id: "to", label: "To", kind: "date" },
  { id: "status", label: "Status", kind: "select" },
] as const;

export const emptyFilters: ReportFilters = {};
