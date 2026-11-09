export function toCsv(rows: Record<string, unknown>[]): string {
  const [head] = rows;
  if (!head) return "";
  const headers = Object.keys(head);
  const lines = rows.map((row) => headers.map((header) => String(row[header] ?? "")).join(","));
  return [headers.join(","), ...lines].join("\n");
}
