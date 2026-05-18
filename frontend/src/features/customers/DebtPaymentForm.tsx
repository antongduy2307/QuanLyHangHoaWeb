import { FormEvent, useState } from "react";

import type { DebtPayment, DebtPaymentPayload } from "../../api/types";

type DebtPaymentFormProps = {
  initialPayment?: DebtPayment | null;
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isPositiveAmount(amount)) {
      setValidationError("So tien thanh toan phai lon hon 0.");
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
      <label>
        So tien thanh toan
        <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <label>
        Thoi gian thanh toan
        <input
          type="datetime-local"
          value={paymentDatetime}
          onChange={(event) => setPaymentDatetime(event.target.value)}
        />
      </label>
      <label>
        Ghi chu
        <textarea value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      {validationError ? <p className="field-error">{validationError}</p> : null}
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
      <div className="form-actions">
        {onCancel ? (
          <button className="secondary-link" type="button" onClick={onCancel}>
            Huy
          </button>
        ) : null}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Dang luu" : submitLabel}
        </button>
      </div>
    </form>
  );
}
