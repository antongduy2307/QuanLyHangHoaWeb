import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { isApiError } from "../../api/errors";
import { useAuth } from "../../auth/useAuth";
import { PageHeader } from "../../components/PageHeader";
import { formatDateTime } from "../../domain/dates";
import { formatQuantity, invoiceStatusLabel, unitLabel } from "../../domain/documents";
import { formatMoney } from "../../domain/money";
import { useDeleteInvoice, useInvoice } from "./invoiceQueries";

const writeRoles = ["owner", "admin"] as const;

export function InvoiceDetailPage() {
  const { invoiceId } = useParams();
  const parsedInvoiceId = Number(invoiceId);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { invoiceMessage?: string } | null;
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const invoiceQuery = useInvoice(parsedInvoiceId);
  const deleteInvoice = useDeleteInvoice(parsedInvoiceId);
  const errorMessage = isApiError(invoiceQuery.error) ? invoiceQuery.error.message : "Khong the tai chi tiet hoa don.";
  const canMutate = user ? writeRoles.some((role) => role === user.role) : false;

  if (!Number.isInteger(parsedInvoiceId) || parsedInvoiceId <= 0) {
    return <p className="state-message error-message">Ma hoa don khong hop le.</p>;
  }

  async function handleDelete() {
    if (!window.confirm("Xoa hoa don nay?")) {
      return;
    }
    setDeleteError(null);
    try {
      await deleteInvoice.mutateAsync();
      navigate("/sales/invoices", { state: { invoiceMessage: "Da xoa hoa don." } });
    } catch (error) {
      setDeleteError(isApiError(error) ? error.message : "Khong the xoa hoa don.");
    }
  }

  return (
    <>
      <div className="page-title-row">
        <PageHeader title="Chi tiet hoa don" description="Thong tin hoa don va cac dong hang." />
        <div className="row-actions">
          {canMutate ? (
            <>
              <Link className="primary-link" to={`/sales/invoices/${parsedInvoiceId}/edit`}>
                Sua hoa don
              </Link>
              <button type="button" onClick={() => void handleDelete()}>
                Xoa hoa don
              </button>
            </>
          ) : null}
          <Link className="secondary-link" to="/sales/invoices">
            Quay lai
          </Link>
        </div>
      </div>

      {invoiceQuery.isLoading ? <p className="state-message">Dang tai chi tiet hoa don...</p> : null}
      {locationState?.invoiceMessage ? <p className="state-message">{locationState.invoiceMessage}</p> : null}
      {invoiceQuery.isError ? <p className="state-message error-message">{errorMessage}</p> : null}
      {deleteError ? <p className="state-message error-message">{deleteError}</p> : null}
      {invoiceQuery.isSuccess ? (
        <>
          <section className="summary-grid" aria-label="Thong tin hoa don">
            <div className="summary-card">
              <span>Ma hoa don</span>
              <strong>{invoiceQuery.data.invoice_code}</strong>
            </div>
            <div className="summary-card">
              <span>Thoi gian</span>
              <strong>{formatDateTime(invoiceQuery.data.invoice_datetime)}</strong>
            </div>
            <div className="summary-card">
              <span>Khach hang</span>
              <strong>{invoiceQuery.data.customer_snapshot_name}</strong>
            </div>
            <div className="summary-card">
              <span>Tong tien</span>
              <strong>{formatMoney(invoiceQuery.data.total_amount)}</strong>
            </div>
            <div className="summary-card">
              <span>Da thanh toan</span>
              <strong>{formatMoney(invoiceQuery.data.paid_amount)}</strong>
            </div>
            <div className="summary-card">
              <span>Trang thai</span>
              <strong>{invoiceStatusLabel(invoiceQuery.data.status)}</strong>
            </div>
            <div className="summary-card">
              <span>Phuong thuc</span>
              <strong>{invoiceQuery.data.payment_method || "-"}</strong>
            </div>
            <div className="summary-card">
              <span>Con lai</span>
              <strong>{formatMoney(String(Number(invoiceQuery.data.total_amount) - Number(invoiceQuery.data.paid_amount)))}</strong>
            </div>
            <div className="summary-card wide">
              <span>Ghi chu</span>
              <strong>{invoiceQuery.data.note || "-"}</strong>
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
                </tr>
              </thead>
              <tbody>
                {invoiceQuery.data.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.product_code_snapshot}</td>
                    <td>{item.product_name_snapshot}</td>
                    <td>{unitLabel(item.unit_type)}</td>
                    <td>{formatQuantity(item.quantity)}</td>
                    <td>{formatMoney(item.unit_price)}</td>
                    <td>{formatMoney(item.line_total)}</td>
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
