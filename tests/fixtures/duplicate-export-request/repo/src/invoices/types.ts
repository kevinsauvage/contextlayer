export type Invoice = {
  id: string;
  orderId: string;
  issuedAt: string;
  totalCents: number;
  status: "draft" | "sent" | "paid" | "void";
};
