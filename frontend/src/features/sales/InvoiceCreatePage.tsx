import { useNavigate } from "react-router-dom";

import { PageHeader } from "../../components/PageHeader";
import { InvoiceForm } from "./InvoiceForm";
import { useCreateInvoice } from "./invoiceQueries";

export function InvoiceCreatePage() {
  const createInvoice = useCreateInvoice();
  const navigate = useNavigate();

  return (
    <>
      <PageHeader title="Tao hoa don" description="Tao hoa don ban hang moi va de backend ghi nhan ton kho/cong no." />
      <InvoiceForm
        mode="create"
        submitLabel="Tao hoa don"
        isSubmitting={createInvoice.isPending}
        onSubmit={async (payload) => {
          const invoice = await createInvoice.mutateAsync(payload);
          navigate(`/sales/invoices/${invoice.id}`);
        }}
      />
    </>
  );
}
