import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { isApiError } from "../../api/errors";
import { useAuth } from "../../auth/useAuth";
import { adminRoutes } from "../../domain/routes";
import { formatDateTime } from "../../domain/dates";
import { formatQuantity, invoiceStatusLabel, unitLabel } from "../../domain/documents";
import { formatMoney } from "../../domain/money";
import { InventoryModuleShell } from "../inventory/InventoryModuleShell";
import { useDeleteInvoice, useInvoice } from "./invoiceQueries";

const writeRoles = ["owner", "admin"] as const;

type InvoiceDetailReturnState = {
  invoiceMessage?: string;
  returnTo?: string;
  returnLabel?: string;
  returnState?: unknown;
};

export function InvoiceDetailPage() {
  const { invoiceId } = useParams();
  const parsedInvoiceId = Number(invoiceId);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state as InvoiceDetailReturnState | null) ?? null;
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const invoiceQuery = useInvoice(parsedInvoiceId);
  const deleteInvoice = useDeleteInvoice(parsedInvoiceId);
  const errorMessage = isApiError(invoiceQuery.error) ? invoiceQuery.error.message : "Không thể tải chi tiết hóa đơn.";
  const canMutate = user ? writeRoles.some((role) => role === user.role) : false;

  if (!Number.isInteger(parsedInvoiceId) || parsedInvoiceId <= 0) {
    return <p className="state-message error-message">Mã hóa đơn không hợp lệ.</p>;
  }

  async function handleDelete() {
    if (!window.confirm("Xóa hóa đơn này?")) {
      return;
    }
    setDeleteError(null);
    try {
      await deleteInvoice.mutateAsync();
      navigate("/sales/invoices", { state: { invoiceMessage: "Đã xóa hóa đơn." } });
    } catch (error) {
      setDeleteError(isApiError(error) ? error.message : "Không thể xóa hóa đơn.");
    }
  }

  const invoice = invoiceQuery.data;
  const remainingAmount = invoice
    ? formatMoney(String(Number(invoice.total_amount) - Number(invoice.paid_amount)))
    : formatMoney("0");
  const backTo = locationState?.returnTo || "/sales/invoices";
  const backLabel = locationState?.returnLabel || "Quay lại";

  return (
    <InventoryModuleShell
      title="Chi tiết hóa đơn"
      description="Theo dõi hóa đơn bán hàng, thanh toán và các dòng hàng đã ghi nhận."
      activeNavPath={adminRoutes.invoices}
      contentClassName="inventory-detail-layout inventory-detail-layout--unified invoice-detail-page"
      compactHero
      hideDescription
      heroActions={
        <div className="row-actions">
          {canMutate ? (
            <>
              <Link
                className="inventory-solid-button"
                to="/sales/invoices/new"
                state={{
                  editInvoiceDraft: {
                    invoiceId: parsedInvoiceId,
                    returnTo: `/sales/invoices/${parsedInvoiceId}`,
                    returnLabel: "Quay lại hóa đơn",
                    detailState: {
                      returnTo: locationState?.returnTo || "/sales/invoices",
                      returnLabel: locationState?.returnLabel || "Quay lại",
                      returnState: locationState?.returnState,
                    },
                  },
                }}
              >
                Sửa hóa đơn
              </Link>
              <button className="inventory-ghost-button inventory-ghost-button--danger" type="button" onClick={() => void handleDelete()}>
                Xóa hóa đơn
              </button>
            </>
          ) : null}
          <Link className="inventory-ghost-button" to={backTo} state={locationState?.returnState}>
            {backLabel}
          </Link>
        </div>
      }
    >
      {invoiceQuery.isLoading ? <p className="state-message">Đang tải chi tiết hóa đơn...</p> : null}
      {locationState?.invoiceMessage ? <p className="state-message">{locationState.invoiceMessage}</p> : null}
      {invoiceQuery.isError ? <p className="state-message error-message">{errorMessage}</p> : null}
      {deleteError ? <p className="state-message error-message">{deleteError}</p> : null}
      {invoice ? (
        <>
          <section className="summary-grid" aria-label="Thông tin hóa đơn">
            <div className="summary-card">
              <span>Mã hóa đơn</span>
              <strong>{invoice.invoice_code}</strong>
            </div>
            <div className="summary-card">
              <span>Thời gian</span>
              <strong>{formatDateTime(invoice.invoice_datetime)}</strong>
            </div>
            <div className="summary-card">
              <span>Khách hàng</span>
              <strong>{invoice.customer_snapshot_name}</strong>
            </div>
            <div className="summary-card">
              <span>Tổng tiền</span>
              <strong>{formatMoney(invoice.total_amount)}</strong>
            </div>
            <div className="summary-card">
              <span>Đã thanh toán</span>
              <strong>{formatMoney(invoice.paid_amount)}</strong>
            </div>
            <div className="summary-card">
              <span>Còn lại</span>
              <strong>{remainingAmount}</strong>
            </div>
            <div className="summary-card">
              <span>Trạng thái</span>
              <strong>{invoiceStatusLabel(invoice.status)}</strong>
            </div>
            <div className="summary-card wide">
              <span>Ghi chú</span>
              <strong>{invoice.note || "-"}</strong>
            </div>
          </section>

          <section className="detail-section" aria-label="Danh sách hàng hóa">
            <div className="section-title-row">
              <h3>Hàng hóa</h3>
              <p className="muted-text">{invoice.items.length} dòng hàng</p>
            </div>
            <div className="table-wrap inventory-table-wrap invoice-detail-table-wrap">
              <table className="data-table inventory-data-table">
                <thead>
                  <tr>
                    <th>Mã hàng</th>
                    <th>Tên hàng</th>
                    <th>Đơn vị</th>
                    <th>Số lượng</th>
                    <th>Đơn giá</th>
                    <th>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
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
          </section>
        </>
      ) : null}
    </InventoryModuleShell>
  );
}
