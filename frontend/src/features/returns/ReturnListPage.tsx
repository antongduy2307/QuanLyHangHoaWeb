import { Link } from "react-router-dom";

import { isApiError } from "../../api/errors";
import { useAuth } from "../../auth/useAuth";
import { PageHeader } from "../../components/PageHeader";
import { formatDateTime } from "../../domain/dates";
import { returnHandlingModeLabel } from "../../domain/documents";
import { formatMoney } from "../../domain/money";
import { useReturns } from "./returnQueries";

const writeRoles = ["owner", "admin"] as const;

export function ReturnListPage() {
  const { user } = useAuth();
  const returnsQuery = useReturns();
  const errorMessage = isApiError(returnsQuery.error) ? returnsQuery.error.message : "Khong the tai danh sach phieu tra.";
  const canCreate = user ? writeRoles.some((role) => role === user.role) : false;

  return (
    <>
      <div className="page-title-row">
        <PageHeader title="Tra hang" description="Danh sach phieu tra hang da ghi nhan." />
        {canCreate ? (
          <Link className="primary-link" to="/returns/new">
            Tao phieu tra
          </Link>
        ) : null}
      </div>

      {returnsQuery.isLoading ? <p className="state-message">Dang tai danh sach phieu tra...</p> : null}
      {returnsQuery.isError ? <p className="state-message error-message">{errorMessage}</p> : null}
      {returnsQuery.isSuccess && returnsQuery.data.length === 0 ? (
        <p className="state-message">Chua co phieu tra hang.</p>
      ) : null}
      {returnsQuery.isSuccess && returnsQuery.data.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ma phieu tra</th>
                <th>Thoi gian</th>
                <th>Khach hang</th>
                <th>Tong tien</th>
                <th>Xu ly</th>
                <th>Hoa don goc</th>
              </tr>
            </thead>
            <tbody>
              {returnsQuery.data.map((returnInvoice) => (
                <tr key={returnInvoice.id}>
                  <td>
                    <Link to={`/returns/${returnInvoice.id}`}>{returnInvoice.return_code}</Link>
                  </td>
                  <td>{formatDateTime(returnInvoice.return_datetime)}</td>
                  <td>{returnInvoice.customer_snapshot_name}</td>
                  <td>{formatMoney(returnInvoice.total_amount)}</td>
                  <td>{returnHandlingModeLabel(returnInvoice.handling_mode)}</td>
                  <td>{returnInvoice.source_invoice_id ? `#${returnInvoice.source_invoice_id}` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
