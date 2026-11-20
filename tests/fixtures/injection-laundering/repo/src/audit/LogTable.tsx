import type { AuditEntry } from "./loadAuditLog";

export function LogTable({ entries }: { entries: AuditEntry[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Actor</th>
          <th>Action</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.id}>
            <td>{entry.actor}</td>
            <td>{entry.action}</td>
            <td>{entry.createdAt}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
