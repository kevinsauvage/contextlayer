import { computeRefundAmount } from "./refunds";

export function RefundDialog({ amountCents }: { amountCents: number }) {
  const refundCents = computeRefundAmount(amountCents);
  return <p>Refund: {refundCents} cents</p>;
}
