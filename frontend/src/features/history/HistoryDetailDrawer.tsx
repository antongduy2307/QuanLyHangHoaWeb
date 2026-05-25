import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { HistoryEvent } from "../../api/types";
import { formatDateTime } from "../../domain/dates";
import { formatQuantity, unitLabel } from "../../domain/documents";
import { formatMoney } from "../../domain/money";
import { useCustomer } from "../customers/customerQueries";
import { useProduct, useProductMovements } from "../inventory/productQueries";
import { useOrder } from "../orders/orderQueries";
import { useReturn } from "../returns/returnQueries";
import { useInvoice } from "../sales/invoiceQueries";
import {
  historyEventTypeLabel,
  historyStatusLabel,
  historyValueSummary,
  resolveHistoryOpenLink,
} from "./historyPresentation";

type HistoryDetailDrawerProps = {
  event: HistoryEvent;
  onClose: () => void;
  returnState?: unknown;
};

function DrawerField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) {
    return null;
  }
  return (
    <div className="history-drawer-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="history-drawer-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function CommonValueSummary({ event }: { event: HistoryEvent }) {
  const lines = historyValueSummary(event);
  if (lines.length === 1 && lines[0] === "-") {
    return null;
  }
  return (
    <DrawerSection title="Giá trị phát sinh">
      <div className="history-drawer-stack">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </DrawerSection>
  );
}

function DrawerOpenLink({ event, returnState }: { event: HistoryEvent; returnState?: unknown }) {
  const openLink = resolveHistoryOpenLink(event);
  if (!openLink) {
    return <span className="history-open-placeholder">Chưa có trang chi tiết khả dụng.</span>;
  }
  return (
    <Link className="inventory-solid-button history-drawer-open-link" to={openLink} state={returnState}>
      Mở chi tiết
    </Link>
  );
}

function HistoryItemsTable({
  items,
}: {
  items: Array<{ id: number; product_name_snapshot: string; unit_type: string; quantity: string; unit_price: string; line_total: string }>;
}) {
  return (
    <div className="table-wrap history-drawer-table-wrap">
      <table className="data-table inventory-data-table history-drawer-table">
        <thead>
          <tr>
            <th>Tên hàng</th>
            <th>Đơn vị</th>
            <th>Số lượng</th>
            <th>Đơn giá</th>
            <th>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
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
  );
}

function InvoiceSection({ event, returnState }: { event: HistoryEvent; returnState?: unknown }) {
  const invoiceQuery = useInvoice(event.event_id);
  const invoice = invoiceQuery.data;

  return (
    <>
      <DrawerSection title="Chi tiết hóa đơn">
        <div className="history-drawer-grid">
          <DrawerField label="Mã hóa đơn" value={invoice?.invoice_code ?? event.code ?? undefined} />
          <DrawerField label="Khách hàng" value={invoice?.customer_snapshot_name ?? event.customer_name ?? undefined} />
          <DrawerField label="Tổng tiền" value={formatMoney(invoice?.total_amount ?? event.amount ?? "0")} />
          <DrawerField label="Đã thanh toán" value={invoice ? formatMoney(invoice.paid_amount) : undefined} />
          <DrawerField label="Trạng thái" value={invoice?.status ?? event.status ?? undefined} />
          <DrawerField label="Phương thức" value={invoice?.payment_method ?? undefined} />
          <DrawerField label="Ghi chú" value={invoice?.note ?? event.note ?? undefined} />
        </div>
      </DrawerSection>
      {invoice?.items.length ? (
        <DrawerSection title="Dòng hàng">
          <HistoryItemsTable items={invoice.items} />
        </DrawerSection>
      ) : null}
      <DrawerSection title="Điều hướng">
        <DrawerOpenLink event={event} returnState={returnState} />
      </DrawerSection>
    </>
  );
}

function ReturnSection({ event, returnState }: { event: HistoryEvent; returnState?: unknown }) {
  const returnQuery = useReturn(event.event_id);
  const returnInvoice = returnQuery.data;

  return (
    <>
      <DrawerSection title="Chi tiết phiếu trả">
        <div className="history-drawer-grid">
          <DrawerField label="Mã phiếu trả" value={returnInvoice?.return_code ?? event.code ?? undefined} />
          <DrawerField label="Khách hàng" value={returnInvoice?.customer_snapshot_name ?? event.customer_name ?? undefined} />
          <DrawerField label="Tổng tiền" value={formatMoney(returnInvoice?.total_amount ?? event.amount ?? "0")} />
          <DrawerField label="Hình thức xử lý" value={historyStatusLabel(event)} />
          <DrawerField
            label="Hóa đơn nguồn"
            value={returnInvoice?.source_invoice_id ? `#${returnInvoice.source_invoice_id}` : undefined}
          />
          <DrawerField label="Ghi chú" value={returnInvoice?.note ?? event.note ?? undefined} />
        </div>
      </DrawerSection>
      {returnInvoice?.items.length ? (
        <DrawerSection title="Dòng hàng">
          <HistoryItemsTable items={returnInvoice.items} />
        </DrawerSection>
      ) : null}
      <DrawerSection title="Điều hướng">
        <DrawerOpenLink event={event} returnState={returnState} />
      </DrawerSection>
    </>
  );
}

function DebtPaymentSection({ event, returnState }: { event: HistoryEvent; returnState?: unknown }) {
  const customerQuery = useCustomer(event.customer_id ?? 0);
  const customerName = customerQuery.data?.customer_name ?? event.customer_name ?? undefined;

  return (
    <>
      <DrawerSection title="Chi tiết thanh toán">
        <div className="history-drawer-grid">
          <DrawerField label="Khách hàng" value={customerName} />
          <DrawerField label="Số tiền" value={formatMoney(event.amount ?? "0")} />
          <DrawerField label="Thời gian thanh toán" value={formatDateTime(event.event_datetime)} />
          <DrawerField label="Ghi chú" value={event.note ?? undefined} />
        </div>
      </DrawerSection>
      <DrawerSection title="Điều hướng">
        <DrawerOpenLink event={event} returnState={returnState} />
      </DrawerSection>
    </>
  );
}

function BalanceAdjustmentSection({ event, returnState }: { event: HistoryEvent; returnState?: unknown }) {
  const customerQuery = useCustomer(event.customer_id ?? 0);
  const customerName = customerQuery.data?.customer_name ?? event.customer_name ?? undefined;

  return (
    <>
      <DrawerSection title="Chi tiết điều chỉnh">
        <div className="history-drawer-grid">
          <DrawerField label="Khách hàng" value={customerName} />
          <DrawerField label="Biến động công nợ" value={formatMoney(event.amount ?? "0")} />
          <DrawerField label="Ghi chú" value={event.note ?? undefined} />
        </div>
      </DrawerSection>
      <DrawerSection title="Điều hướng">
        <DrawerOpenLink event={event} returnState={returnState} />
      </DrawerSection>
    </>
  );
}

function StockMovementSection({ event, returnState }: { event: HistoryEvent; returnState?: unknown }) {
  const productQuery = useProduct(event.product_id ?? 0);
  const movementsQuery = useProductMovements(event.product_id ?? 0);
  const movement = movementsQuery.data?.find((row) => row.source_type === event.source_type && row.source_id === event.source_id);
  const quantity = movement?.quantity_delta ?? event.quantity;
  const unitType = movement?.unit_type ?? event.unit_type;
  const status = movement?.movement_type ?? event.status;

  return (
    <>
      <DrawerSection title="Chi tiết biến động tồn kho">
        <div className="history-drawer-grid">
          <DrawerField label="Sản phẩm" value={productQuery.data?.product_name ?? event.product_name ?? undefined} />
          <DrawerField label="Loại biến động" value={status ?? undefined} />
          <DrawerField
            label="Số lượng"
            value={
              quantity
                ? `${Number(quantity).toLocaleString("vi-VN", { minimumFractionDigits: 0, maximumFractionDigits: 3 })}${unitType ? ` ${unitType}` : ""}`
                : undefined
            }
          />
          <DrawerField
            label="Tồn sau biến động"
            value={movement?.balance_after ? `${movement.balance_after}${unitType ? ` ${unitType}` : ""}` : undefined}
          />
          <DrawerField label="Nguồn phát sinh" value={event.source_type ?? undefined} />
          <DrawerField label="Mã nguồn" value={event.source_id ? `#${event.source_id}` : undefined} />
        </div>
      </DrawerSection>
      <DrawerSection title="Điều hướng">
        <DrawerOpenLink event={event} returnState={returnState} />
      </DrawerSection>
    </>
  );
}

function OrderSection({ event }: { event: HistoryEvent }) {
  const orderQuery = useOrder(event.event_id, event.event_type === "ORDER");
  const order = orderQuery.data;

  return (
    <>
      <DrawerSection title="Chi tiết đặt hàng">
        <div className="history-drawer-grid">
          <DrawerField label="Mã đơn" value={order?.order_code ?? event.code ?? undefined} />
          <DrawerField label="Khách hàng" value={order?.customer_name_snapshot ?? event.customer_name ?? undefined} />
          <DrawerField label="Trạng thái" value={historyStatusLabel(event)} />
          <DrawerField label="Giao dự kiến" value={formatDateTime(order?.required_delivery_datetime)} />
          <DrawerField label="Ghi chú" value={order?.note ?? event.note ?? undefined} />
        </div>
      </DrawerSection>
      <DrawerSection title="Điều hướng">
        <span className="history-open-placeholder">Chưa có trang chi tiết đơn đặt hàng.</span>
      </DrawerSection>
    </>
  );
}

export function HistoryDetailDrawer({ event, onClose, returnState }: HistoryDetailDrawerProps) {
  return (
    <aside className="history-drawer" aria-label="Chi tiết giao dịch">
      <div className="history-drawer__header">
        <div>
          <p className="inventory-subtext">Xem nhanh giao dịch</p>
          <h3>{historyEventTypeLabel(event.event_type)}</h3>
        </div>
        <button className="inventory-ghost-button" type="button" onClick={onClose}>
          Đóng
        </button>
      </div>

      <DrawerSection title="Tóm tắt">
        <div className="history-drawer-grid">
          <DrawerField label="Thời gian" value={formatDateTime(event.event_datetime)} />
          <DrawerField label="Mã chứng từ" value={event.code ?? undefined} />
          <DrawerField label="Khách hàng" value={event.customer_name ?? undefined} />
          <DrawerField label="Sản phẩm" value={event.product_name ?? undefined} />
          <DrawerField label="Trạng thái" value={historyStatusLabel(event)} />
          <DrawerField label="Ghi chú" value={event.note ?? undefined} />
        </div>
      </DrawerSection>

      <CommonValueSummary event={event} />

      {event.event_type === "SALES_INVOICE" ? <InvoiceSection event={event} returnState={returnState} /> : null}
      {event.event_type === "RETURN_INVOICE" ? <ReturnSection event={event} returnState={returnState} /> : null}
      {event.event_type === "DEBT_PAYMENT" ? <DebtPaymentSection event={event} returnState={returnState} /> : null}
      {event.event_type === "BALANCE_ADJUSTMENT" ? <BalanceAdjustmentSection event={event} returnState={returnState} /> : null}
      {event.event_type === "STOCK_MOVEMENT" ? <StockMovementSection event={event} returnState={returnState} /> : null}
      {event.event_type === "ORDER" ? <OrderSection event={event} /> : null}
    </aside>
  );
}
