export function CardForm() {
  return (
    <form>
      <input name="cardNumber" placeholder="Card number" />
      <input name="expiry" placeholder="MM/YY" />
      <input name="cvc" aria-label="Security code" placeholder="CVC" />
    </form>
  );
}
