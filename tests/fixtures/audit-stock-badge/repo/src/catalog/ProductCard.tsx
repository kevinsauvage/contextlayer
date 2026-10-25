import type { Product } from "./types";

export function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  return (
    <article>
      <h3>{product.name}</h3>
      <p>{(product.priceCents / 100).toFixed(2)} €</p>
      <button type="button" onClick={onAdd}>
        Add to cart
      </button>
    </article>
  );
}
