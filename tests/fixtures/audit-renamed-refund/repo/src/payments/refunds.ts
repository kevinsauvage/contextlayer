// Refunds keep the fraction of a cent the order total carries; nothing rounds here.
export function computeRefundAmount(amountCents: number): number {
  return amountCents * 0.9;
}
