import { useNavigate } from "react-router-dom";

import { PageHeader } from "../../components/PageHeader";
import { ReturnForm } from "./ReturnForm";
import { useCreateReturn } from "./returnQueries";

export function ReturnCreatePage() {
  const createReturn = useCreateReturn();
  const navigate = useNavigate();

  return (
    <>
      <PageHeader title="Tao phieu tra" description="Tao phieu tra hang moi va de backend ghi nhan ton kho/cong no." />
      <ReturnForm
        mode="create"
        submitLabel="Tao phieu tra"
        isSubmitting={createReturn.isPending}
        onSubmit={async (payload) => {
          const returnInvoice = await createReturn.mutateAsync(payload);
          navigate(`/returns/${returnInvoice.id}`, { state: { returnMessage: "Da tao phieu tra." } });
        }}
      />
    </>
  );
}
