export function first<T>(items: readonly T[], description = "item"): T {
  const [item] = items;
  if (item === undefined) throw new Error(`Expected at least one ${description}`);
  return item;
}
