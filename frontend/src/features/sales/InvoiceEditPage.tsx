import { Link, useNavigate, useParams } from "react-router-dom";

import { isApiError } from "../../api/errors";
import { PageHeader } from "../../components/PageHeader";
import { InvoiceForm } from "./InvoiceForm";
import { useInvoice, useUpdateInvoice } from "./invoiceQueries";

export function InvoiceEditPage() {
  const { invoiceId } = useParams();
  const parsedInvoiceId = Number(invoiceId);
  const invoiceQuery = useInvoice(parsedInvoiceId);
  const updateInvoice = useUpdateInvoice(parsedInvoiceId);
  const navigate = useNavigate();
  const errorMessage = isApiError(invoiceQuery.error) ? invoiceQuery.error.message : "Khong the tai hoa don.";

  if (!Number.isInteger(parsedInvoiceId) || parsedInvoiceId <= 0) {
    return <p className="state-message error-message">Ma hoa don khong hop le.</p>;
  }

  return (
    <>
      <div className="page-title-row">
        <PageHeader title="Sua hoa don" description="Cap nhat hoa don va de backend rollback/reapply ton kho cong no." />
        <Link className="secondary-link" to={`/sales/invoices/${parsedInvoiceId}`}>
          Quay lai
        </Link>
      </div>

      {invoiceQuery.isLoading ? <p className="state-message">Dang tai hoa don...</p> : null}
      {invoiceQuery.isError ? <p className="state-message error-message">{errorMessage}</p> : null}
      {invoiceQuery.isSuccess ? (
        <InvoiceForm
          key={invoiceQuery.data.id}
          mode="edit"
          initialInvoice={invoiceQuery.data}
          submitLabel="Luu hoa don"
          isSubmitting={updateInvoice.isPending}
          errorMessage={isApiError(updateInvoice.error) ? updateInvoice.error.message : null}
          onSubmit={async (payload) => {
            const invoice = await updateInvoice.mutateAsync(payload);
            navigate(`/sales/invoices/${invoice.id}`);
          }}
        />
      ) : null}
    </>
  );
}
