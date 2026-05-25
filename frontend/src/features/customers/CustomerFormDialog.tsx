import { FormEvent, useState } from "react";

import { isApiError } from "../../api/errors";
import type { Customer } from "../../api/types";
import {
  customerToEditableFormState,
  initialCustomerFormState,
  toCustomerCreatePayload,
  toCustomerUpdatePayload,
  validateCustomerEditableForm,
  validateCustomerForm,
  type CustomerFormState,
} from "./customerSchemas";
import { useAdjustCustomerBalance, useCreateCustomer, useUpdateCustomer } from "./customerQueries";

type CustomerFormDialogProps = {
  customer?: Customer | null;
  onClose: () => void;
};

export function CustomerFormDialog({ customer, onClose }: CustomerFormDialogProps) {
  const isEditMode = Boolean(customer);
  const [formState, setFormState] = useState<CustomerFormState>(() =>
    customer ? customerToEditableFormState(customer) : initialCustomerFormState,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer(customer?.id ?? 0);
  const adjustCustomerBalance = useAdjustCustomerBalance(customer?.id ?? 0);

  function updateField(field: keyof CustomerFormState, value: string) {
    setFormState((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const errors = isEditMode ? validateCustomerEditableForm(formState) : validateCustomerForm(formState);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      if (!customer) {
        await createCustomer.mutateAsync(toCustomerCreatePayload(formState));
        onClose();
        return;
      }

      await updateCustomer.mutateAsync(toCustomerUpdatePayload(formState));
      const normalizedTargetBalance = formState.opening_balance.trim() || "0";
      if (normalizedTargetBalance !== customer.current_balance) {
        await adjustCustomerBalance.mutateAsync({
          target_balance: normalizedTargetBalance,
          note: formState.note.trim() || null,
        });
      }
      onClose();
    } catch (error) {
      setFormError(
        isApiError(error)
          ? error.message
          : customer
            ? "Không thể cập nhật khách hàng."
            : "Không thể tạo khách hàng.",
      );
    }
  }

  const isSubmitting = createCustomer.isPending || updateCustomer.isPending || adjustCustomerBalance.isPending;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card customer-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="customer-modal-card__header">
          <div>
            <h3 id="customer-modal-title">{customer ? "Sửa khách hàng" : "Tạo khách hàng"}</h3>
            <p>{customer ? "Cập nhật thông tin và công nợ mục tiêu." : "Tạo hồ sơ khách hàng và số dư ban đầu nếu có."}</p>
          </div>
          <button className="inventory-ghost-button" type="button" onClick={onClose}>
            Đóng
          </button>
        </div>

        <form className="customer-modal-form" onSubmit={handleSubmit}>
          <div className="customer-modal-form__grid">
            <label>
              Tên khách hàng
              <input value={formState.customer_name} onChange={(event) => updateField("customer_name", event.target.value)} />
              {fieldErrors.customer_name ? <span className="field-error">{fieldErrors.customer_name}</span> : null}
            </label>
            <label>
              Điện thoại
              <input value={formState.phone} onChange={(event) => updateField("phone", event.target.value)} />
            </label>
            <label className="customer-modal-form__wide">
              Địa chỉ
              <input value={formState.address} onChange={(event) => updateField("address", event.target.value)} />
            </label>
            <label className="customer-modal-form__wide">
              Ghi chú
              <textarea value={formState.note} onChange={(event) => updateField("note", event.target.value)} />
            </label>
            <label>
              {customer ? "Công nợ mục tiêu" : "Số dư ban đầu"}
              <input
                inputMode="decimal"
                value={formState.opening_balance}
                onChange={(event) => updateField("opening_balance", event.target.value)}
              />
              {fieldErrors.opening_balance ? <span className="field-error">{fieldErrors.opening_balance}</span> : null}
            </label>
            {customer ? (
              <div className="customer-modal-metric">
                <span>Tổng mua</span>
                <strong>{customer.total_sales}</strong>
              </div>
            ) : null}
          </div>

          {formError ? <p className="form-error">{formError}</p> : null}

          <div className="form-actions">
            <button className="secondary-link" type="button" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (customer ? "Đang lưu" : "Đang tạo") : customer ? "Lưu khách hàng" : "Tạo khách hàng"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
