import type { ReportRow } from "./loadReport";

export function ReportTable({ rows }: { rows: ReportRow[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Orders</th>
          <th>Revenue</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.date}>
            <td>{row.date}</td>
            <td>{row.orders}</td>
            <td>{row.revenueCents / 100}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
