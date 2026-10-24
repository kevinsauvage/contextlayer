export function CartTotal({ totalCents }: { totalCents: number }) {
  return <p className="cart-total">Total: {(totalCents / 100).toFixed(2)} EUR</p>;
}
