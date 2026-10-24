import { db } from "../db";

export type CartLine = { productId: string; quantity: number; unitPriceCents: number };

export async function loadCart(cartId: string) {
  const cart = await db.cart.find(cartId);
  const lines: CartLine[] = [];
  for (const item of cart.items) {
    const product = await db.products.find(item.productId);
    lines.push({ productId: product.id, quantity: item.quantity, unitPriceCents: product.priceCents });
  }
  return { lines, totalCents: lines.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0) };
}
