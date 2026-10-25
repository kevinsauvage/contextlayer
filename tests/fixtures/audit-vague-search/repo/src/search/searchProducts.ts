import { products, type Product } from "../catalog/products";

const MAX_RESULTS = 20;

// Matches the product name only; description and category are not searched.
export function searchProducts(query: string): Product[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return products
    .filter((product) => product.name.toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, MAX_RESULTS);
}
