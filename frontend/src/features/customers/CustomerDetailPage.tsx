import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { isApiError } from "../../api/errors";
import type { DebtPayment } from "../../api/types";
import { useAuth } from "../../auth/useAuth";
import { PageHeader } from "../../components/PageHeader";
import { formatDateTime } from "../../domain/dates";
import { formatMoney } from "../../domain/money";
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
    return <p className="state-message error-message">Ma khach hang khong hop le.</p>;
  }

  const error = customerQuery.error || ledgerQuery.error || debtPaymentsQuery.error;
  const errorMessage = isApiError(error) ? error.message : "Khong the tai chi tiet khach hang.";

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
      setMutationSuccess("Da dieu chinh cong no.");
    } catch (adjustmentError) {
      setMutationError(isApiError(adjustmentError) ? adjustmentError.message : "Khong the dieu chinh cong no.");
    }
  }

  async function handleDeletePayment(paymentId: number) {
    if (!window.confirm("Xoa thanh toan cong no nay?")) {
      return;
    }
    setMutationError(null);
    setMutationSuccess(null);
    try {
      await deleteDebtPayment.mutateAsync(paymentId);
      setMutationSuccess("Da xoa thanh toan cong no.");
    } catch (deleteError) {
      setMutationError(isApiError(deleteError) ? deleteError.message : "Khong the xoa thanh toan.");
    }
  }

  async function handleDeleteCustomer() {
    if (!window.confirm("Xoa hoac ngung dung khach hang nay?")) {
      return;
    }
    setDeleteCustomerError(null);
    try {
      const result = await deleteCustomer.mutateAsync();
      navigate("/customers", {
        state: {
          customerDeleteMessage:
            result.action === "hard_deleted"
              ? "Khach hang da duoc xoa vinh vien."
              : "Khach hang da duoc ngung dung.",
        },
      });
    } catch (error) {
      setDeleteCustomerError(isApiError(error) ? error.message : "Khong the xoa khach hang.");
    }
  }

  return (
    <>
      <div className="page-title-row">
        <PageHeader title="Chi tiet khach hang" description="Thong tin ho so va lich su ledger cong no." />
        <div className="row-actions">
          {canMutate && customerQuery.isSuccess ? (
            <>
              <Link className="primary-link" to={`/customers/${parsedCustomerId}/edit`}>
                Sua khach hang
              </Link>
              <button type="button" onClick={() => void handleDeleteCustomer()}>
                Xoa khach hang
              </button>
            </>
          ) : null}
          <Link className="secondary-link" to="/customers">
            Quay lai
          </Link>
        </div>
      </div>

      {customerQuery.isLoading || ledgerQuery.isLoading || debtPaymentsQuery.isLoading ? (
        <p className="state-message">Dang tai chi tiet khach hang...</p>
      ) : null}
      {customerQuery.isError || ledgerQuery.isError || debtPaymentsQuery.isError ? (
        <p className="state-message error-message">{errorMessage}</p>
      ) : null}
      {deleteCustomerError ? <p className="state-message error-message">{deleteCustomerError}</p> : null}
      {customerQuery.isSuccess ? (
        <section className="summary-grid" aria-label="Thong tin khach hang">
          <div className="summary-card">
            <span>Ten khach hang</span>
            <strong>{customerQuery.data.customer_name}</strong>
          </div>
          <div className="summary-card">
            <span>Dien thoai</span>
            <strong>{customerQuery.data.phone || "-"}</strong>
          </div>
          <div className="summary-card">
            <span>So du</span>
            <strong>{formatMoney(customerQuery.data.current_balance)}</strong>
          </div>
          <div className="summary-card">
            <span>Tong mua</span>
            <strong>{formatMoney(customerQuery.data.total_sales)}</strong>
          </div>
          <div className="summary-card wide">
            <span>Dia chi</span>
            <strong>{customerQuery.data.address || "-"}</strong>
          </div>
          <div className="summary-card wide">
            <span>Ghi chu</span>
            <strong>{customerQuery.data.note || "-"}</strong>
          </div>
        </section>
      ) : null}

      {debtPaymentsQuery.isSuccess ? (
        <section className="detail-section" aria-label="Thanh toan cong no">
          <div className="section-title-row">
            <h3>Thanh toan cong no</h3>
            {canMutate ? (
              <button className="primary-link" type="button" onClick={() => setShowCreateForm((current) => !current)}>
                Them thanh toan
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
                So du muc tieu
                <input
                  type="number"
                  step="0.01"
                  value={targetBalance}
                  onChange={(event) => setTargetBalance(event.target.value)}
                  required
                />
              </label>
              <label>
                Ghi chu
                <textarea value={balanceAdjustmentNote} onChange={(event) => setBalanceAdjustmentNote(event.target.value)} />
              </label>
              {isApiError(adjustCustomerBalance.error) ? <p className="form-error">{adjustCustomerBalance.error.message}</p> : null}
              <div className="form-actions">
                <button type="submit" disabled={adjustCustomerBalance.isPending}>
                  {adjustCustomerBalance.isPending ? "Dang luu..." : "Luu dieu chinh"}
                </button>
                <button type="button" onClick={() => setShowBalanceAdjustment(false)}>
                  Huy
                </button>
              </div>
            </form>
          ) : null}
          {showCreateForm && canMutate ? (
            <DebtPaymentForm
              submitLabel="Them thanh toan"
              isSubmitting={createDebtPayment.isPending}
              errorMessage={isApiError(createDebtPayment.error) ? createDebtPayment.error.message : null}
              onCancel={() => setShowCreateForm(false)}
              onSubmit={async (payload) => {
                try {
                  setMutationSuccess(null);
                  await createDebtPayment.mutateAsync(payload);
                  setShowCreateForm(false);
                  setMutationSuccess("Da them thanh toan cong no.");
                } catch {
                  // React Query stores the error for the form-level message.
                }
              }}
            />
          ) : null}
          {debtPaymentsQuery.data.length === 0 ? <p className="state-message">Chua co thanh toan cong no.</p> : null}
          {debtPaymentsQuery.data.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ma</th>
                    <th>So tien</th>
                    <th>Thoi gian</th>
                    <th>Ghi chu</th>
                    <th>Trang thai</th>
                    {canMutate ? <th>Thao tac</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {debtPaymentsQuery.data.map((payment) => (
                    <tr key={payment.id}>
                      <td>#{payment.id}</td>
                      <td>{formatMoney(payment.amount)}</td>
                      <td>{formatDateTime(payment.payment_datetime)}</td>
                      <td>{payment.note || "-"}</td>
                      <td>{payment.is_deleted ? "Da xoa" : "Dang hieu luc"}</td>
                      {canMutate ? (
                        <td>
                          <div className="row-actions">
                            <button type="button" onClick={() => setEditingPayment(payment)}>
                              Sua
                            </button>
                            <button type="button" onClick={() => void handleDeletePayment(payment.id)}>
                              Xoa
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
              <h4>Sua thanh toan #{editingPayment.id}</h4>
              <DebtPaymentForm
                key={editingPayment.id}
                initialPayment={editingPayment}
                submitLabel="Luu thanh toan"
                isSubmitting={updateDebtPayment.isPending}
                errorMessage={isApiError(updateDebtPayment.error) ? updateDebtPayment.error.message : null}
                onCancel={() => setEditingPayment(null)}
                onSubmit={async (payload) => {
                  try {
                    setMutationSuccess(null);
                    await updateDebtPayment.mutateAsync({ paymentId: editingPayment.id, payload });
                    setEditingPayment(null);
                    setMutationSuccess("Da cap nhat thanh toan cong no.");
                  } catch {
                    // React Query stores the error for the form-level message.
                  }
                }}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {ledgerQuery.isSuccess && ledgerQuery.data.length === 0 ? <p className="state-message">Chua co ledger cong no.</p> : null}
      {ledgerQuery.isSuccess && ledgerQuery.data.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Thoi gian</th>
                <th>Su kien</th>
                <th>Tham chieu</th>
                <th>Phat sinh</th>
                <th>So du sau</th>
                <th>Ghi chu</th>
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
    </>
  );
}
