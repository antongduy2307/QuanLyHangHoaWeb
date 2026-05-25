import { FormEvent, useState } from "react";

import type { DebtPayment, DebtPaymentPayload } from "../../api/types";
import { formatMoney } from "../../domain/money";

type DebtPaymentFormProps = {
  initialPayment?: DebtPayment | null;
  currentBalance?: string | null;
  isSubmitting: boolean;
  submitLabel: string;
  errorMessage?: string | null;
  onCancel?: () => void;
  onSubmit: (payload: DebtPaymentPayload) => Promise<void>;
};

const positiveDecimalPattern = /^(?:[1-9]\d*|0)(?:\.\d{1,2})?$/;

function toLocalDateTimeInput(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function toApiDateTime(value: string) {
  if (!value) {
    return null;
  }
  return new Date(value).toISOString();
}

function isPositiveAmount(value: string) {
  const normalizedValue = value.trim();
  if (!positiveDecimalPattern.test(normalizedValue)) {
    return false;
  }
  return !/^0(?:\.0{1,2})?$/.test(normalizedValue);
}

export function DebtPaymentForm({
  initialPayment,
  currentBalance,
  isSubmitting,
  submitLabel,
  errorMessage,
  onCancel,
  onSubmit,
}: DebtPaymentFormProps) {
  const [amount, setAmount] = useState(initialPayment?.amount ?? "");
  const [paymentDatetime, setPaymentDatetime] = useState(toLocalDateTimeInput(initialPayment?.payment_datetime));
  const [note, setNote] = useState(initialPayment?.note ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);
  const normalizedCurrentBalance = Number(currentBalance ?? "0");
  const normalizedAmount = Number(amount || "0");
  const estimatedBalance = Number.isFinite(normalizedAmount) ? normalizedCurrentBalance - normalizedAmount : normalizedCurrentBalance;
  const balanceTone =
    estimatedBalance > 0 ? "customer-balance-preview--debt" : estimatedBalance < 0 ? "customer-balance-preview--credit" : "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isPositiveAmount(amount)) {
      setValidationError("Số tiền thanh toán phải lớn hơn 0.");
      return;
    }
    setValidationError(null);
    await onSubmit({
      amount: amount.trim(),
      payment_datetime: toApiDateTime(paymentDatetime),
      note: note.trim() || null,
    });
    if (!initialPayment) {
      setAmount("");
      setPaymentDatetime("");
      setNote("");
    }
  }

  return (
    <form className="form-panel compact-form" onSubmit={handleSubmit}>
      {currentBalance !== undefined ? (
        <div className="customer-balance-preview">
          <div>
            <span>Công nợ hiện tại</span>
            <strong>{formatMoney(currentBalance)}</strong>
          </div>
          <div>
            <span>Ước tính sau thanh toán</span>
            <strong className={balanceTone}>{formatMoney(estimatedBalance.toFixed(2))}</strong>
          </div>
        </div>
      ) : null}
      <label>
        Số tiền thanh toán
        <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <label>
        Thời gian thanh toán
        <input
          type="datetime-local"
          value={paymentDatetime}
          onChange={(event) => setPaymentDatetime(event.target.value)}
        />
      </label>
      <label>
        Ghi chú
        <textarea value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      {validationError ? <p className="field-error">{validationError}</p> : null}
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
      <div className="form-actions">
        {onCancel ? (
          <button className="secondary-link" type="button" onClick={onCancel}>
            Hủy
          </button>
        ) : null}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Đang lưu" : submitLabel}
        </button>
      </div>
    </form>
  );
}
