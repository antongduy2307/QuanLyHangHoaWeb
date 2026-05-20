import { Link, useNavigate, useParams } from "react-router-dom";

import { isApiError } from "../../api/errors";
import { PageHeader } from "../../components/PageHeader";
import { ReturnForm } from "./ReturnForm";
import { useReturn, useUpdateReturn } from "./returnQueries";

export function ReturnEditPage() {
  const { returnId } = useParams();
  const parsedReturnId = Number(returnId);
  const returnQuery = useReturn(parsedReturnId);
  const updateReturn = useUpdateReturn(parsedReturnId);
  const navigate = useNavigate();
  const errorMessage = isApiError(returnQuery.error) ? returnQuery.error.message : "Khong the tai phieu tra.";

  if (!Number.isInteger(parsedReturnId) || parsedReturnId <= 0) {
    return <p className="state-message error-message">Ma phieu tra khong hop le.</p>;
  }

  return (
    <>
      <div className="page-title-row">
        <PageHeader title="Sua phieu tra" description="Cap nhat phieu tra va de backend rollback/reapply ton kho cong no." />
        <Link className="secondary-link" to={`/returns/${parsedReturnId}`}>
          Quay lai
        </Link>
      </div>

      {returnQuery.isLoading ? <p className="state-message">Dang tai phieu tra...</p> : null}
      {returnQuery.isError ? <p className="state-message error-message">{errorMessage}</p> : null}
      {returnQuery.isSuccess ? (
        <ReturnForm
          key={returnQuery.data.id}
          mode="edit"
          initialReturn={returnQuery.data}
          submitLabel="Luu phieu tra"
          isSubmitting={updateReturn.isPending}
          errorMessage={isApiError(updateReturn.error) ? updateReturn.error.message : null}
          onSubmit={async (payload) => {
            const returnInvoice = await updateReturn.mutateAsync(payload);
            navigate(`/returns/${returnInvoice.id}`, { state: { returnMessage: "Da cap nhat phieu tra." } });
          }}
        />
      ) : null}
    </>
  );
}
