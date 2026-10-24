import { useState } from "react";
import { filters, type ReportFilters } from "./filters";

export function ReportList() {
  const [active, setActive] = useState<ReportFilters>({});

  return (
    <section>
      <FilterBar options={filters} value={active} onChange={setActive} />
      <ReportTable filters={active} />
    </section>
  );
}
