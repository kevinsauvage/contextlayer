import { LOYALTY_FREE_SHIPPING_THRESHOLD_CENTS, STANDARD_FREE_SHIPPING_THRESHOLD_CENTS } from "../pricing/rules";

export type Customer = { id: string; loyaltyMember: boolean };

export function freeShippingThresholdFor(customer: Customer): number {
  return customer.loyaltyMember ? LOYALTY_FREE_SHIPPING_THRESHOLD_CENTS : STANDARD_FREE_SHIPPING_THRESHOLD_CENTS;
}

export function shipsFree(customer: Customer, subtotalCents: number): boolean {
  return subtotalCents >= freeShippingThresholdFor(customer);
}
