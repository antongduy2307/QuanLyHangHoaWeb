import { type FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { isApiError } from "../../api/errors";
import type { Customer, CustomerLedgerRow, DebtPayment, HistoryEvent, Invoice, ReturnInvoice } from "../../api/types";
import { useAuth } from "../../auth/useAuth";
import { formatDateTime } from "../../domain/dates";
import { formatMoney } from "../../domain/money";
import { HistoryDetailDrawer } from "../history/HistoryDetailDrawer";
import { useReturns } from "../returns/returnQueries";
import { useInvoices } from "../sales/invoiceQueries";
import { DebtPaymentForm } from "./DebtPaymentForm";
import {
  useAdjustCustomerBalance,
  useCreateDebtPayment,
  useCustomer,
  useCustomerLedger,
  useDebtPayments,
  useDeleteDebtPayment,
  useUpdateDebtPayment,
} from "./customerQueries";

const writeRoles = ["owner", "admin"] as const;
const tabOptions = [
  { label: "Thông tin chung", value: "general" },
  { label: "Lịch sử bán/trả hàng", value: "history" },
  { label: "Nợ cần thu từ khách", value: "debt" },
] as const;

type CustomerInlineTab = (typeof tabOptions)[number]["value"];
type CustomerTimelineEntry = {
  key: string;
  timestamp: string | null;
  typeLabel: string;
  referenceLabel: string;
  amount: string;
  balanceAfter: string;
  note: string | null;
};

function balanceStatusLabel(balance: string) {
  const value = Number(balance);
  if (value > 0) {
    return "Khách còn nợ";
  }
  if (value < 0) {
    return "Khách trả trước";
  }
  return "Cân bằng";
}
type CustomerTradeEntry = {
  key: string;
  timestamp: string;
  typeLabel: string;
  referenceLabel: string;
  itemSummary: string;
  amount: string;
  href: string;
  detailEvent: HistoryEvent;
};

function canMutateCustomers(role: string) {
  return writeRoles.some((writeRole) => writeRole === role);
}

function joinItemNames(items: { product_name_snapshot: string }[]) {
  const names = new Set(
    items
      .map((item) => item.product_name_snapshot.trim())
      .filter(Boolean),
  );
  return names.size > 0 ? Array.from(names).join(", ") : "-";
}

function inferInvoiceCodeFromNote(note: string | null) {
  const normalizedNote = (note || "").trim();
  const prefix = "Payment for invoice ";
  return normalizedNote.startsWith(prefix) ? normalizedNote.slice(prefix.length) : null;
}

function debtTypeLabel(row: CustomerLedgerRow, invoicesById: Map<number, Invoice>, returnsById: Map<number, ReturnInvoice>) {
  if (row.ref_type === "INVOICE" || row.event_type === "INVOICE_CHARGE") {
    return "Bán hàng";
  }
  if (row.ref_type === "RETURN") {
    return "Trả hàng";
  }
  if (row.event_type === "OPENING_BALANCE") {
    return "Nợ đầu kỳ";
  }
  if (row.event_type === "BALANCE_ADJUSTMENT") {
    return "Điều chỉnh công nợ";
  }
  if (row.ref_type === "DEBT_PAYMENT") {
    return inferInvoiceCodeFromNote(row.note) ? "Thanh toán hóa đơn" : "Trả nợ";
  }
  if (returnsById.has(row.ref_id)) {
    return "Trả hàng";
  }
  return row.event_type;
}

function debtReferenceLabel(
  row: CustomerLedgerRow,
  invoicesById: Map<number, Invoice>,
  invoicesByCode: Map<string, Invoice>,
  returnsById: Map<number, ReturnInvoice>,
) {
  if (row.ref_type === "INVOICE" || row.event_type === "INVOICE_CHARGE") {
    return invoicesById.get(row.ref_id)?.invoice_code ?? `Invoice #${row.ref_id}`;
  }
  if (row.ref_type === "RETURN") {
    return returnsById.get(row.ref_id)?.return_code ?? `Return #${row.ref_id}`;
  }
  const invoiceCode = inferInvoiceCodeFromNote(row.note);
  if (row.ref_type === "DEBT_PAYMENT" && invoiceCode) {
    return invoicesByCode.get(invoiceCode)?.invoice_code ?? invoiceCode;
  }
  if (row.ref_type === "DEBT_PAYMENT") {
    return `Payment #${row.ref_id}`;
  }
  return `${row.ref_type} #${row.ref_id}`;
}

function buildTradeHistory(invoices: Invoice[], returns: ReturnInvoice[]) {
  const invoiceEntries: CustomerTradeEntry[] = invoices.map((invoice) => ({
    key: `invoice-${invoice.id}`,
    timestamp: invoice.invoice_datetime,
    typeLabel: "Bán hàng",
    referenceLabel: invoice.invoice_code,
    itemSummary: joinItemNames(invoice.items),
    amount: invoice.total_amount,
    href: `/sales/invoices/${invoice.id}`,
    detailEvent: {
      event_type: "SALES_INVOICE",
      event_id: invoice.id,
      event_datetime: invoice.invoice_datetime,
      display_order: 0,
      code: invoice.invoice_code,
      customer_id: invoice.customer_id,
      customer_name: invoice.customer_snapshot_name,
      product_id: null,
      product_name: null,
      amount: invoice.total_amount,
      paid_amount: invoice.paid_amount,
      item_count: invoice.items.length,
      quantity: null,
      unit_type: null,
      status: invoice.status,
      source_type: "invoice",
      source_id: invoice.id,
      note: invoice.note,
      open_target: { target_type: "invoice", target_id: invoice.id, route: `/sales/invoices/${invoice.id}` },
    },
  }));
  const returnEntries: CustomerTradeEntry[] = returns.map((returnInvoice) => ({
    key: `return-${returnInvoice.id}`,
    timestamp: returnInvoice.return_datetime,
    typeLabel: "Trả hàng",
    referenceLabel: returnInvoice.return_code,
    itemSummary: joinItemNames(returnInvoice.items),
    amount: returnInvoice.total_amount,
    href: `/returns/${returnInvoice.id}`,
    detailEvent: {
      event_type: "RETURN_INVOICE",
      event_id: returnInvoice.id,
      event_datetime: returnInvoice.return_datetime,
      display_order: 0,
      code: returnInvoice.return_code,
      customer_id: returnInvoice.customer_id,
      customer_name: returnInvoice.customer_snapshot_name,
      product_id: null,
      product_name: null,
      amount: returnInvoice.total_amount,
      paid_amount: null,
      item_count: returnInvoice.items.length,
      quantity: null,
      unit_type: null,
      status: returnInvoice.handling_mode,
      source_type: "return",
      source_id: returnInvoice.id,
      note: returnInvoice.note,
      open_target: { target_type: "return", target_id: returnInvoice.id, route: `/returns/${returnInvoice.id}` },
    },
  }));

  return [...invoiceEntries, ...returnEntries].sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );
}

function buildDebtTimeline(
  ledgerRows: CustomerLedgerRow[],
  invoices: Invoice[],
  returns: ReturnInvoice[],
): CustomerTimelineEntry[] {
  const invoicesById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const invoicesByCode = new Map(invoices.map((invoice) => [invoice.invoice_code, invoice]));
  const returnsById = new Map(returns.map((returnInvoice) => [returnInvoice.id, returnInvoice]));
  const latestPaymentRows = new Map<number, CustomerLedgerRow>();

  for (const row of ledgerRows) {
    if (row.ref_type === "DEBT_PAYMENT" && row.event_type === "DEBT_PAYMENT") {
      latestPaymentRows.set(row.ref_id, row);
    }
  }

  return ledgerRows
    .filter((row) => {
      if (row.event_type === "DEBT_PAYMENT_EDIT_ROLLBACK") {
        return false;
      }
      if (row.ref_type === "DEBT_PAYMENT" && row.event_type === "DEBT_PAYMENT") {
        return latestPaymentRows.get(row.ref_id)?.id === row.id;
      }
      if (row.ref_type === "INVOICE" && row.event_type !== "INVOICE_CHARGE") {
        return false;
      }
      return true;
    })
    .map((row) => ({
      key: `debt-${row.id}`,
      timestamp: row.transaction_datetime,
      typeLabel: debtTypeLabel(row, invoicesById, returnsById),
      referenceLabel: debtReferenceLabel(row, invoicesById, invoicesByCode, returnsById),
      amount: row.ref_type === "DEBT_PAYMENT" ? String(Math.abs(Number(row.amount_delta)).toFixed(2)) : row.amount_delta,
      balanceAfter: row.balance_after,
      note: row.note,
    }))
    .sort((left, right) => {
      const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : 0;
      const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : 0;
      return rightTime - leftTime;
    });
}

export function CustomerInlineDetailPanel({
  customerId,
  onEditRequest,
  initialActiveTab,
}: {
  customerId: number;
  onEditRequest?: (customer: Customer) => void;
  initialActiveTab?: CustomerInlineTab;
}) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<CustomerInlineTab>(initialActiveTab ?? "general");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showBalanceAdjustment, setShowBalanceAdjustment] = useState(false);
  const [targetBalance, setTargetBalance] = useState("");
  const [balanceAdjustmentNote, setBalanceAdjustmentNote] = useState("");
  const [editingPayment, setEditingPayment] = useState<DebtPayment | null>(null);
  const [selectedTradeEvent, setSelectedTradeEvent] = useState<HistoryEvent | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutationSuccess, setMutationSuccess] = useState<string | null>(null);
  const customerQuery = useCustomer(customerId);
  const ledgerQuery = useCustomerLedger(customerId);
  const debtPaymentsQuery = useDebtPayments(customerId);
  const invoicesQuery = useInvoices("", "", "", customerId);
  const returnsQuery = useReturns("", "", "", customerId);
  const adjustCustomerBalance = useAdjustCustomerBalance(customerId);
  const createDebtPayment = useCreateDebtPayment(customerId);
  const updateDebtPayment = useUpdateDebtPayment(customerId);
  const deleteDebtPayment = useDeleteDebtPayment(customerId);
  const canMutate = user ? canMutateCustomers(user.role) : false;
  const isLoading = customerQuery.isLoading || ledgerQuery.isLoading || debtPaymentsQuery.isLoading || invoicesQuery.isLoading || returnsQuery.isLoading;
  const error = customerQuery.error || ledgerQuery.error || debtPaymentsQuery.error || invoicesQuery.error || returnsQuery.error;
  const tradeHistory = useMemo(
    () => buildTradeHistory(invoicesQuery.data ?? [], returnsQuery.data ?? []),
    [invoicesQuery.data, returnsQuery.data],
  );
  const debtTimeline = useMemo(
    () => buildDebtTimeline(ledgerQuery.data ?? [], invoicesQuery.data ?? [], returnsQuery.data ?? []),
    [ledgerQuery.data, invoicesQuery.data, returnsQuery.data],
  );
  const parsedTargetBalance = Number(targetBalance || customerQuery.data?.current_balance || "0");
  const parsedCurrentBalance = Number(customerQuery.data?.current_balance || "0");
  const balanceDelta = parsedTargetBalance - parsedCurrentBalance;

  function openBalanceAdjustment() {
    setTargetBalance(customerQuery.data?.current_balance ?? "");
    setBalanceAdjustmentNote("");
    setMutationError(null);
    setMutationSuccess(null);
    setShowBalanceAdjustment(true);
  }

  async function handleBalanceAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMutationError(null);
    setMutationSuccess(null);
    try {
      await adjustCustomerBalance.mutateAsync({
        target_balance: targetBalance.trim(),
        note: balanceAdjustmentNote.trim() || null,
      });
      setShowBalanceAdjustment(false);
      setMutationSuccess("Đã điều chỉnh công nợ.");
    } catch (adjustmentError) {
      setMutationError(isApiError(adjustmentError) ? adjustmentError.message : "Không thể điều chỉnh công nợ.");
    }
  }

  async function handleDeletePayment(paymentId: number) {
    if (!window.confirm("Xóa thanh toán công nợ này?")) {
      return;
    }
    setMutationError(null);
    setMutationSuccess(null);
    try {
      await deleteDebtPayment.mutateAsync(paymentId);
      setMutationSuccess("Đã xóa thanh toán công nợ.");
    } catch (deleteError) {
      setMutationError(isApiError(deleteError) ? deleteError.message : "Không thể xóa thanh toán.");
    }
  }

  return (
    <div className="customer-inline-detail-panel" aria-label={`Chi tiết khách hàng #${customerId}`}>
      <div className="customer-inline-detail-panel__tabs" role="tablist" aria-label="Chi tiết khách hàng">
        {tabOptions.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={["customer-inline-tab", activeTab === tab.value ? "active" : ""].filter(Boolean).join(" ")}
            role="tab"
            aria-selected={activeTab === tab.value}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.value === "general"
              ? "Thông tin chung"
              : tab.value === "history"
                ? "Lịch sử bán/trả hàng"
                : "Nợ cần thu từ khách"}
          </button>
        ))}
      </div>

      {isLoading ? <p className="state-message">Đang tải chi tiết khách hàng...</p> : null}
      {error ? (
        <p className="state-message error-message">
          {isApiError(error) ? error.message : "Không thể tải dữ liệu chi tiết khách hàng."}
        </p>
      ) : null}

      {!isLoading && !error && customerQuery.data ? (
        <>
          {activeTab === "general" ? (
            <section className="customer-inline-tab-panel">
              <div className="customer-inline-section-heading">
                <h4>Thông tin chung</h4>
                <span>Hồ sơ tổng quan và thao tác nhanh</span>
              </div>
              <div className="customer-inline-summary-grid">
                <div className="customer-inline-summary-card">
                  <span>Tên khách hàng</span>
                  <strong>{customerQuery.data.customer_name}</strong>
                </div>
                <div className="customer-inline-summary-card">
                  <span>Điện thoại</span>
                  <strong>{customerQuery.data.phone || "-"}</strong>
                </div>
                <div className="customer-inline-summary-card">
                  <span>Công nợ hiện tại</span>
                  <strong>{formatMoney(customerQuery.data.current_balance)}</strong>
                </div>
                <div className="customer-inline-summary-card">
                  <span>Tổng mua</span>
                  <strong>{formatMoney(customerQuery.data.total_sales)}</strong>
                </div>
                <div className="customer-inline-summary-card customer-inline-summary-card--wide">
                  <span>Địa chỉ</span>
                  <strong>{customerQuery.data.address || "-"}</strong>
                </div>
                <div className="customer-inline-summary-card customer-inline-summary-card--wide">
                  <span>Ghi chú</span>
                  <strong>{customerQuery.data.note || "-"}</strong>
                </div>
              </div>
              <div className="customer-inline-actions">
                <Link className="inventory-ghost-button" to={`/customers/${customerId}`}>
                  Mở chi tiết
                </Link>
                {canMutate ? (
                  onEditRequest ? (
                    <button className="inventory-solid-button" type="button" onClick={() => onEditRequest(customerQuery.data)}>
                      Sửa khách hàng
                    </button>
                  ) : (
                    <Link className="inventory-solid-button" to={`/customers/${customerId}/edit`}>
                      Sửa khách hàng
                    </Link>
                  )
                ) : null}
              </div>
            </section>
          ) : null}

          {activeTab === "history" ? (
            <section className="customer-inline-tab-panel">
              <div className="customer-inline-section-heading">
                <h4>Lịch sử bán/trả hàng</h4>
                <span>Giao dịch gần nhất của khách</span>
              </div>
              {tradeHistory.length === 0 ? <p className="state-message">Chưa có lịch sử bán hoặc trả hàng.</p> : null}
              {tradeHistory.length > 0 ? (
                <div className={selectedTradeEvent ? "history-workspace history-workspace--with-drawer" : "history-workspace"}>
                  <div className="inventory-table-wrap customer-inline-table-wrap">
                  <table className="data-table inventory-data-table customer-inline-table history-data-table">
                    <thead>
                      <tr>
                        <th>Thời gian</th>
                        <th>Loại giao dịch</th>
                        <th>Mã phiếu</th>
                        <th>Hàng đã giao dịch</th>
                        <th>Giá trị</th>
                        <th>Mở</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tradeHistory.map((entry) => {
                        const isSelected =
                          selectedTradeEvent?.event_type === entry.detailEvent.event_type
                          && selectedTradeEvent.event_id === entry.detailEvent.event_id;
                        return (
                        <tr
                          key={entry.key}
                          className={isSelected ? "history-row-selected" : undefined}
                          data-selected={isSelected ? "true" : "false"}
                          onClick={() => setSelectedTradeEvent(entry.detailEvent)}
                        >
                          <td>{formatDateTime(entry.timestamp)}</td>
                          <td>{entry.typeLabel}</td>
                          <td>{entry.referenceLabel}</td>
                          <td>{entry.itemSummary}</td>
                          <td>{formatMoney(entry.amount)}</td>
                          <td>
                            <button
                              className="inventory-ghost-button history-open-link"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedTradeEvent(entry.detailEvent);
                              }}
                            >
                              Xem
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                  {selectedTradeEvent ? (
                    <HistoryDetailDrawer
                      event={selectedTradeEvent}
                      onClose={() => setSelectedTradeEvent(null)}
                      returnState={{
                        returnTo: "/customers",
                        returnLabel: "Quay lại khách hàng",
                        returnState: {
                          focusCustomerId: customerId,
                          openInlineTab: "history",
                        },
                      }}
                    />
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {activeTab === "debt" ? (
            <section className="customer-inline-tab-panel">
              <div className="customer-inline-balance-bar">
                <div>
                  <span>Nợ cần thu hiện tại</span>
                  <strong>{formatMoney(customerQuery.data.current_balance)}</strong>
                  <em>{balanceStatusLabel(customerQuery.data.current_balance)}</em>
                </div>
                {canMutate ? (
                  <div className="customer-inline-actions">
                    <button className="inventory-ghost-button" type="button" onClick={openBalanceAdjustment}>
                      Điều chỉnh công nợ
                    </button>
                    <button
                      className="inventory-solid-button"
                      type="button"
                      onClick={() => setShowCreateForm((current) => !current)}
                    >
                      Thanh toán
                    </button>
                  </div>
                ) : null}
              </div>

              {mutationError ? <p className="form-error">{mutationError}</p> : null}
              {mutationSuccess ? <p className="state-message">{mutationSuccess}</p> : null}

              {showBalanceAdjustment && canMutate ? (
                <form className="inline-edit-panel customer-inline-form-panel" onSubmit={(event) => void handleBalanceAdjustment(event)}>
                  <h4>Điều chỉnh công nợ</h4>
                  <div className="customer-balance-preview">
                    <div>
                      <span>Công nợ hiện tại</span>
                      <strong>{formatMoney(customerQuery.data.current_balance)}</strong>
                    </div>
                    <div>
                      <span>Công nợ mục tiêu</span>
                      <strong>{formatMoney(Number.isFinite(parsedTargetBalance) ? parsedTargetBalance.toFixed(2) : customerQuery.data.current_balance)}</strong>
                    </div>
                    <div>
                      <span>Phát sinh dự kiến</span>
                      <strong className={balanceDelta > 0 ? "customer-balance-preview--debt" : balanceDelta < 0 ? "customer-balance-preview--credit" : ""}>
                        {formatMoney(Number.isFinite(balanceDelta) ? balanceDelta.toFixed(2) : "0")}
                      </strong>
                    </div>
                  </div>
                  <label>
                    Công nợ mục tiêu
                    <input
                      type="number"
                      step="0.01"
                      value={targetBalance}
                      onChange={(event) => setTargetBalance(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Ghi chú
                    <textarea value={balanceAdjustmentNote} onChange={(event) => setBalanceAdjustmentNote(event.target.value)} />
                  </label>
                  <p className="customer-inline-hint">Điều chỉnh này đặt lại công nợ mục tiêu và vẫn ghi nhận qua balance-adjustment hiện có.</p>
                  {isApiError(adjustCustomerBalance.error) ? <p className="form-error">{adjustCustomerBalance.error.message}</p> : null}
                  <div className="form-actions">
                    <button type="submit" disabled={adjustCustomerBalance.isPending}>
                      {adjustCustomerBalance.isPending ? "Đang lưu..." : "Lưu điều chỉnh"}
                    </button>
                    <button type="button" onClick={() => setShowBalanceAdjustment(false)}>
                      Hủy
                    </button>
                  </div>
                </form>
              ) : null}

              {showCreateForm && canMutate ? (
                <DebtPaymentForm
                  currentBalance={customerQuery.data.current_balance}
                  submitLabel="Ghi nhận thanh toán"
                  isSubmitting={createDebtPayment.isPending}
                  errorMessage={isApiError(createDebtPayment.error) ? createDebtPayment.error.message : null}
                  onCancel={() => setShowCreateForm(false)}
                  onSubmit={async (payload) => {
                    try {
                      setMutationSuccess(null);
                      await createDebtPayment.mutateAsync(payload);
                      setShowCreateForm(false);
                      setMutationSuccess("Đã thêm thanh toán công nợ.");
                    } catch {
                      // React Query stores the error for the form-level message.
                    }
                  }}
                />
              ) : null}

              {editingPayment ? (
                <div className="inline-edit-panel customer-inline-form-panel">
                  <h4>Sửa thanh toán #{editingPayment.id}</h4>
                  <DebtPaymentForm
                    key={editingPayment.id}
                    initialPayment={editingPayment}
                    currentBalance={customerQuery.data.current_balance}
                    submitLabel="Lưu thanh toán"
                    isSubmitting={updateDebtPayment.isPending}
                    errorMessage={isApiError(updateDebtPayment.error) ? updateDebtPayment.error.message : null}
                    onCancel={() => setEditingPayment(null)}
                    onSubmit={async (payload) => {
                      try {
                        setMutationSuccess(null);
                        await updateDebtPayment.mutateAsync({ paymentId: editingPayment.id, payload });
                        setEditingPayment(null);
                        setMutationSuccess("Đã cập nhật thanh toán công nợ.");
                      } catch {
                        // React Query stores the error for the form-level message.
                      }
                    }}
                  />
                </div>
              ) : null}

              <div className="customer-inline-debt-grid">
                <section>
                  <div className="customer-inline-section-heading">
                    <h4>Thanh toán công nợ</h4>
                    <span>Thêm, sửa hoặc xóa phiếu thanh toán</span>
                  </div>
                  {debtPaymentsQuery.data && debtPaymentsQuery.data.length === 0 ? (
                    <p className="state-message">Chưa có thanh toán công nợ.</p>
                  ) : null}
                  {debtPaymentsQuery.data && debtPaymentsQuery.data.length > 0 ? (
                    <div className="inventory-table-wrap customer-inline-table-wrap">
                      <table className="data-table inventory-data-table customer-inline-table">
                        <thead>
                          <tr>
                            <th>Mã phiếu</th>
                            <th>Số tiền thanh toán</th>
                            <th>Thời gian</th>
                            <th>Ghi chú</th>
                            {canMutate ? <th>Thao tác</th> : null}
                          </tr>
                        </thead>
                        <tbody>
                          {debtPaymentsQuery.data.map((payment) => (
                            <tr key={payment.id}>
                              <td>#{payment.id}</td>
                              <td>{formatMoney(payment.amount)}</td>
                              <td>{formatDateTime(payment.payment_datetime)}</td>
                              <td>{payment.note || "-"}</td>
                              {canMutate ? (
                                <td>
                                  <div className="row-actions">
                                    <button type="button" onClick={() => setEditingPayment(payment)}>
                                      Sửa
                                    </button>
                                    <button type="button" onClick={() => void handleDeletePayment(payment.id)}>
                                      Xóa
                                    </button>
                                  </div>
                                </td>
                              ) : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </section>

                <section>
                  <div className="customer-inline-section-heading">
                    <h4>Lịch sử công nợ</h4>
                    <span>Được sắp theo ledger hiện có</span>
                  </div>
                  {debtTimeline.length === 0 ? <p className="state-message">Chưa có lịch sử công nợ.</p> : null}
                  {debtTimeline.length > 0 ? (
                    <div className="inventory-table-wrap customer-inline-table-wrap">
                      <table className="data-table inventory-data-table customer-inline-table">
                        <thead>
                          <tr>
                            <th>Thời gian</th>
                            <th>Diễn giải</th>
                            <th>Tham chiếu</th>
                            <th>Phát sinh</th>
                            <th>Dư nợ khách hàng</th>
                            <th>Ghi chú</th>
                          </tr>
                        </thead>
                        <tbody>
                          {debtTimeline.map((entry) => (
                            <tr key={entry.key}>
                              <td>{formatDateTime(entry.timestamp)}</td>
                              <td>{entry.typeLabel}</td>
                              <td>{entry.referenceLabel}</td>
                              <td>{formatMoney(entry.amount)}</td>
                              <td>{formatMoney(entry.balanceAfter)}</td>
                              <td>{entry.note || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </section>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
