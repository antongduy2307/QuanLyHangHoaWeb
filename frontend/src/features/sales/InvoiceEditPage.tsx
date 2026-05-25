import { Navigate, useParams } from "react-router-dom";

export function InvoiceEditPage() {
  const { invoiceId } = useParams();
  const parsedInvoiceId = Number(invoiceId);

  if (!Number.isInteger(parsedInvoiceId) || parsedInvoiceId <= 0) {
    return <p className="state-message error-message">Mã hóa đơn không hợp lệ.</p>;
  }

  return (
    <Navigate
      replace
      to="/sales/invoices/new"
      state={{
        editInvoiceDraft: {
          invoiceId: parsedInvoiceId,
          returnTo: `/sales/invoices/${parsedInvoiceId}`,
          returnLabel: "Quay lại hóa đơn",
          detailState: {
            returnTo: "/sales/invoices",
            returnLabel: "Quay lại",
          },
        },
      }}
    />
  );
}
