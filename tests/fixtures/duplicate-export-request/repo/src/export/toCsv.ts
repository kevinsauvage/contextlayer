export async function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0] ?? {});
  return [columns.join(","), ...rows.map((row) => columns.map((column) => String(row[column] ?? "")).join(","))].join(
    "\n",
  );
}
