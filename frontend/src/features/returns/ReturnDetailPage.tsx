import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { isApiError } from "../../api/errors";
import { useAuth } from "../../auth/useAuth";
import { PageHeader } from "../../components/PageHeader";
import { formatDateTime } from "../../domain/dates";
import { formatQuantity, returnHandlingModeLabel, unitLabel } from "../../domain/documents";
import { formatMoney } from "../../domain/money";
import { useDeleteReturn, useReturn } from "./returnQueries";

const writeRoles = ["owner", "admin"] as const;

export function ReturnDetailPage() {
  const { returnId } = useParams();
  const parsedReturnId = Number(returnId);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { returnMessage?: string } | null;
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const returnQuery = useReturn(parsedReturnId);
  const deleteReturn = useDeleteReturn(parsedReturnId);
  const errorMessage = isApiError(returnQuery.error) ? returnQuery.error.message : "Khong the tai chi tiet phieu tra.";
  const canMutate = user ? writeRoles.some((role) => role === user.role) : false;

  if (!Number.isInteger(parsedReturnId) || parsedReturnId <= 0) {
    return <p className="state-message error-message">Ma phieu tra khong hop le.</p>;
  }

  async function handleDelete() {
    if (!window.confirm("Xoa phieu tra nay?")) {
      return;
    }
    setDeleteError(null);
    try {
      await deleteReturn.mutateAsync();
      navigate("/returns", { state: { returnMessage: "Da xoa phieu tra." } });
    } catch (error) {
      setDeleteError(isApiError(error) ? error.message : "Khong the xoa phieu tra.");
    }
  }

  return (
    <>
      <div className="page-title-row">
        <PageHeader title="Chi tiet phieu tra" description="Thong tin phieu tra va cac dong hang." />
        <div className="row-actions">
          {canMutate ? (
            <>
              <Link className="primary-link" to={`/returns/${parsedReturnId}/edit`}>
                Sua phieu tra
              </Link>
              <button type="button" onClick={() => void handleDelete()}>
                Xoa phieu tra
              </button>
            </>
          ) : null}
          <Link className="secondary-link" to="/returns">
            Quay lai
          </Link>
        </div>
      </div>

      {locationState?.returnMessage ? <p className="state-message">{locationState.returnMessage}</p> : null}
      {returnQuery.isLoading ? <p className="state-message">Dang tai chi tiet phieu tra...</p> : null}
      {returnQuery.isError ? <p className="state-message error-message">{errorMessage}</p> : null}
      {deleteError ? <p className="state-message error-message">{deleteError}</p> : null}
      {returnQuery.isSuccess ? (
        <>
          <section className="summary-grid" aria-label="Thong tin phieu tra">
            <div className="summary-card">
              <span>Ma phieu tra</span>
              <strong>{returnQuery.data.return_code}</strong>
            </div>
            <div className="summary-card">
              <span>Thoi gian</span>
              <strong>{formatDateTime(returnQuery.data.return_datetime)}</strong>
            </div>
            <div className="summary-card">
              <span>Khach hang</span>
              <strong>{returnQuery.data.customer_snapshot_name}</strong>
            </div>
            <div className="summary-card">
              <span>Loai phieu</span>
              <strong>{returnQuery.data.is_quick_return ? "Tra nhanh" : "Tra theo hoa don"}</strong>
            </div>
            <div className="summary-card">
              <span>Tong tien</span>
              <strong>{formatMoney(returnQuery.data.total_amount)}</strong>
            </div>
            <div className="summary-card">
              <span>Xu ly</span>
              <strong>{returnHandlingModeLabel(returnQuery.data.handling_mode)}</strong>
            </div>
            <div className="summary-card">
              <span>Hoa don goc</span>
              <strong>{returnQuery.data.source_invoice_id ? `#${returnQuery.data.source_invoice_id}` : "-"}</strong>
            </div>
            <div className="summary-card wide">
              <span>Ghi chu</span>
              <strong>{returnQuery.data.note || "-"}</strong>
            </div>
          </section>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ma hang</th>
                  <th>Ten hang</th>
                  <th>Don vi</th>
                  <th>So luong</th>
                  <th>Don gia</th>
                  <th>Thanh tien</th>
                  <th>Dong hoa don goc</th>
                </tr>
              </thead>
              <tbody>
                {returnQuery.data.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.product_code_snapshot}</td>
                    <td>{item.product_name_snapshot}</td>
                    <td>{unitLabel(item.unit_type)}</td>
                    <td>{formatQuantity(item.quantity)}</td>
                    <td>{formatMoney(item.unit_price)}</td>
                    <td>{formatMoney(item.line_total)}</td>
                    <td>{item.source_invoice_item_id ? `#${item.source_invoice_item_id}` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}
