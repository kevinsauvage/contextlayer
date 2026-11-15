import { cancelInvoice, type Invoice } from "./invoices";

type Props = { invoice: Invoice; onChange: (invoice: Invoice) => void };

export function InvoiceActions({ invoice, onChange }: Props) {
  const cancel = () => {
    const cancelled = cancelInvoice(invoice.id);
    if (cancelled) onChange(cancelled);
  };

  return (
    <div className="invoice-actions">
      <a href={`/invoices/${invoice.id}/pdf`}>Télécharger le PDF</a>
      <button type="button" onClick={cancel} disabled={invoice.status === "cancelled"}>
        Annuler la facture
      </button>
    </div>
  );
}
