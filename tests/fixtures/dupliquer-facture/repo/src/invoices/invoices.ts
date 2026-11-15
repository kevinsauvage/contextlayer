export type InvoiceStatus = "draft" | "sent" | "cancelled";

export type Invoice = {
  id: string;
  customerId: string;
  issuedAt: string;
  dueDate: string;
  totalCents: number;
  status: InvoiceStatus;
};

const invoices = new Map<string, Invoice>();

export function getInvoice(id: string): Invoice | undefined {
  return invoices.get(id);
}

export function saveInvoice(invoice: Invoice): Invoice {
  invoices.set(invoice.id, invoice);
  return invoice;
}

export function cancelInvoice(id: string): Invoice | undefined {
  const invoice = invoices.get(id);
  if (!invoice || invoice.status === "cancelled") return invoice;
  return saveInvoice({ ...invoice, status: "cancelled" });
}
