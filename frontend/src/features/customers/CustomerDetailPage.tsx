import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { isApiError } from "../../api/errors";
import type { DebtPayment } from "../../api/types";
import { useAuth } from "../../auth/useAuth";
import { formatDateTime } from "../../domain/dates";
import { formatMoney } from "../../domain/money";
import { InventoryModuleShell } from "../inventory/InventoryModuleShell";
import { DebtPaymentForm } from "./DebtPaymentForm";
import {
  useAdjustCustomerBalance,
  useCreateDebtPayment,
  useCustomer,
  useCustomerLedger,
  useDeleteCustomer,
  useDebtPayments,
  useDeleteDebtPayment,
  useUpdateDebtPayment,
} from "./customerQueries";

const writeRoles = ["owner", "admin"] as const;

function canMutateDebtPayment(role: string) {
  return writeRoles.some((writeRole) => writeRole === role);
}

export function CustomerDetailPage() {
  const { customerId } = useParams();
  const parsedCustomerId = Number(customerId);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showBalanceAdjustment, setShowBalanceAdjustment] = useState(false);
  const [targetBalance, setTargetBalance] = useState("");
  const [balanceAdjustmentNote, setBalanceAdjustmentNote] = useState("");
  const [editingPayment, setEditingPayment] = useState<DebtPayment | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutationSuccess, setMutationSuccess] = useState<string | null>(null);
  const [deleteCustomerError, setDeleteCustomerError] = useState<string | null>(null);
  const customerQuery = useCustomer(parsedCustomerId);
  const ledgerQuery = useCustomerLedger(parsedCustomerId);
  const debtPaymentsQuery = useDebtPayments(parsedCustomerId);
  const adjustCustomerBalance = useAdjustCustomerBalance(parsedCustomerId);
  const createDebtPayment = useCreateDebtPayment(parsedCustomerId);
  const updateDebtPayment = useUpdateDebtPayment(parsedCustomerId);
  const deleteCustomer = useDeleteCustomer(parsedCustomerId);
  const deleteDebtPayment = useDeleteDebtPayment(parsedCustomerId);
  const canMutate = user ? canMutateDebtPayment(user.role) : false;

  if (!Number.isInteger(parsedCustomerId) || parsedCustomerId <= 0) {
    return <p className="state-message error-message">Mã khách hàng không hợp lệ.</p>;
  }

  const error = customerQuery.error || ledgerQuery.error || debtPaymentsQuery.error;
  const errorMessage = isApiError(error) ? error.message : "Không thể tải chi tiết khách hàng.";

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
      setMutationSuccess("Đã điều chỉnh công nợ.");
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
      setMutationSuccess("Đã xóa thanh toán công nợ.");
    } catch (deleteError) {
      setMutationError(isApiError(deleteError) ? deleteError.message : "Không thể xóa thanh toán.");
    }
  }

  async function handleDeleteCustomer() {
    if (!window.confirm("Xóa hoặc ngừng dùng khách hàng này?")) {
      return;
    }
    setDeleteCustomerError(null);
    try {
      const result = await deleteCustomer.mutateAsync();
      navigate("/customers", {
        state: {
          customerDeleteMessage:
            result.action === "hard_deleted"
              ? "Khách hàng đã được xóa vĩnh viễn."
              : "Khách hàng đã được ngừng dùng.",
        },
      });
    } catch (error) {
      setDeleteCustomerError(isApiError(error) ? error.message : "Không thể xóa khách hàng.");
    }
  }

  return (
    <InventoryModuleShell
      title="Chi tiết khách hàng"
      description="Thông tin hồ sơ và lịch sử ledger công nợ."
      contentClassName="inventory-detail-layout inventory-detail-layout--unified"
      compactHero
      hideDescription
      heroActions={
        <div className="row-actions">
          {canMutate && customerQuery.isSuccess ? (
            <>
              <Link className="inventory-solid-button" to={`/customers/${parsedCustomerId}/edit`}>
                Sửa khách hàng
              </Link>
              <button className="inventory-ghost-button inventory-ghost-button--danger" type="button" onClick={() => void handleDeleteCustomer()}>
                Xóa khách hàng
              </button>
            </>
          ) : null}
          <Link className="inventory-ghost-button" to="/customers">
            Quay lại
          </Link>
        </div>
      }
    >
      {customerQuery.isLoading || ledgerQuery.isLoading || debtPaymentsQuery.isLoading ? (
        <p className="state-message">Đang tải chi tiết khách hàng...</p>
      ) : null}
      {customerQuery.isError || ledgerQuery.isError || debtPaymentsQuery.isError ? (
        <p className="state-message error-message">{errorMessage}</p>
      ) : null}
      {deleteCustomerError ? <p className="state-message error-message">{deleteCustomerError}</p> : null}
      {customerQuery.isSuccess ? (
        <section className="summary-grid" aria-label="Thông tin khách hàng">
          <div className="summary-card">
            <span>Tên khách hàng</span>
            <strong>{customerQuery.data.customer_name}</strong>
          </div>
          <div className="summary-card">
            <span>Điện thoại</span>
            <strong>{customerQuery.data.phone || "-"}</strong>
          </div>
          <div className="summary-card">
            <span>Số dư</span>
            <strong>{formatMoney(customerQuery.data.current_balance)}</strong>
          </div>
          <div className="summary-card">
            <span>Tổng mua</span>
            <strong>{formatMoney(customerQuery.data.total_sales)}</strong>
          </div>
          <div className="summary-card wide">
            <span>Địa chỉ</span>
            <strong>{customerQuery.data.address || "-"}</strong>
          </div>
          <div className="summary-card wide">
            <span>Ghi chú</span>
            <strong>{customerQuery.data.note || "-"}</strong>
          </div>
        </section>
      ) : null}

      {debtPaymentsQuery.isSuccess ? (
        <section className="detail-section" aria-label="Thanh toán công nợ">
          <div className="section-title-row">
            <h3>Thanh toán công nợ</h3>
            {canMutate ? (
              <button className="primary-link" type="button" onClick={() => setShowCreateForm((current) => !current)}>
                Thêm thanh toán
              </button>
            ) : null}
          </div>
          {mutationError ? <p className="form-error">{mutationError}</p> : null}
          {mutationSuccess ? <p className="state-message">{mutationSuccess}</p> : null}
          {canMutate ? (
            <div className="row-actions">
              <button type="button" onClick={openBalanceAdjustment}>
                Điều chỉnh công nợ
              </button>
            </div>
          ) : null}
          {showBalanceAdjustment && canMutate ? (
            <form className="inline-edit-panel" onSubmit={(event) => void handleBalanceAdjustment(event)}>
              <h4>Điều chỉnh công nợ</h4>
              <label>
                Số dư mục tiêu
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
              currentBalance={customerQuery.data?.current_balance}
              submitLabel="Thêm thanh toán"
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
          {debtPaymentsQuery.data.length === 0 ? <p className="state-message">Chưa có thanh toán công nợ.</p> : null}
          {debtPaymentsQuery.data.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Số tiền</th>
                    <th>Thời gian</th>
                    <th>Ghi chú</th>
                    <th>Trạng thái</th>
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
                      <td>{payment.is_deleted ? "Đã xóa" : "Đang hiệu lực"}</td>
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
          {editingPayment ? (
            <div className="inline-edit-panel">
              <h4>Sửa thanh toán #{editingPayment.id}</h4>
              <DebtPaymentForm
                key={editingPayment.id}
                initialPayment={editingPayment}
                currentBalance={customerQuery.data?.current_balance}
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
        </section>
      ) : null}

      {ledgerQuery.isSuccess && ledgerQuery.data.length === 0 ? <p className="state-message">Chưa có ledger công nợ.</p> : null}
      {ledgerQuery.isSuccess && ledgerQuery.data.length > 0 ? (
        <div className="inventory-table-wrap customer-table-wrap">
          <table className="data-table inventory-data-table customer-inline-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Sự kiện</th>
                <th>Tham chiếu</th>
                <th>Phát sinh</th>
                <th>Số dư sau</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {ledgerQuery.data.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.transaction_datetime)}</td>
                  <td>{row.event_type}</td>
                  <td>
                    {row.ref_type} #{row.ref_id}
                  </td>
                  <td>{formatMoney(row.amount_delta)}</td>
                  <td>{formatMoney(row.balance_after)}</td>
                  <td>{row.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </InventoryModuleShell>
  );
}
