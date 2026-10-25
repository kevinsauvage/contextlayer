import { useState } from "react";
import { searchProducts } from "./searchProducts";

export function SearchBox() {
  const [results, setResults] = useState<ReturnType<typeof searchProducts>>([]);
  return (
    <div>
      <input type="search" placeholder="Search products" onChange={(e) => setResults(searchProducts(e.target.value))} />
      <ul>
        {results.map((product) => (
          <li key={product.id}>{product.name}</li>
        ))}
      </ul>
    </div>
  );
}
