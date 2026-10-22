export type Order = {
  id: string;
  customerId: string;
  status: "pending" | "paid" | "refunded";
  totalCents: number;
  currency: string;
  createdAt: string;
};
