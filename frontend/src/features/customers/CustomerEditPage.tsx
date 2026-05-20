import { FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { isApiError } from "../../api/errors";
import type { Customer } from "../../api/types";
import { PageHeader } from "../../components/PageHeader";
import {
  customerToEditableFormState,
  toCustomerUpdatePayload,
  validateCustomerEditableForm,
  type CustomerFormState,
} from "./customerSchemas";
import { useCustomer, useUpdateCustomer } from "./customerQueries";

export function CustomerEditPage() {
  const { customerId } = useParams();
  const parsedCustomerId = Number(customerId);
  const customerQuery = useCustomer(parsedCustomerId);
  const errorMessage = isApiError(customerQuery.error) ? customerQuery.error.message : "Khong the tai khach hang.";

  if (!Number.isInteger(parsedCustomerId) || parsedCustomerId <= 0) {
    return <p className="state-message error-message">Ma khach hang khong hop le.</p>;
  }

  return (
    <>
      <div className="page-title-row">
        <PageHeader title="Sua khach hang" description="Cap nhat ho so khach hang. Cong no duoc dieu chinh qua ledger/thanh toan." />
        <Link className="secondary-link" to={`/customers/${parsedCustomerId}`}>
          Quay lai
        </Link>
      </div>

      {customerQuery.isLoading ? <p className="state-message">Dang tai khach hang...</p> : null}
      {customerQuery.isError ? <p className="state-message error-message">{errorMessage}</p> : null}
      {customerQuery.isSuccess ? <CustomerEditForm customer={customerQuery.data} /> : null}
    </>
  );
}

function CustomerEditForm({ customer }: { customer: Customer }) {
  const [formState, setFormState] = useState<CustomerFormState>(() => customerToEditableFormState(customer));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const updateCustomer = useUpdateCustomer(customer.id);
  const navigate = useNavigate();

  function updateField(field: keyof Pick<CustomerFormState, "customer_name" | "phone" | "address" | "note">, value: string) {
    setFormState((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const errors = validateCustomerEditableForm(formState);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      const updatedCustomer = await updateCustomer.mutateAsync(toCustomerUpdatePayload(formState));
      navigate(`/customers/${updatedCustomer.id}`);
    } catch (error) {
      setFormError(isApiError(error) ? error.message : "Khong the cap nhat khach hang.");
    }
  }

  return (
    <form className="form-panel" onSubmit={handleSubmit}>
      <label>
        Ten khach hang
        <input value={formState.customer_name} onChange={(event) => updateField("customer_name", event.target.value)} />
        {fieldErrors.customer_name ? <span className="field-error">{fieldErrors.customer_name}</span> : null}
      </label>
      <label>
        Dien thoai
        <input value={formState.phone} onChange={(event) => updateField("phone", event.target.value)} />
      </label>
      <label>
        Dia chi
        <input value={formState.address} onChange={(event) => updateField("address", event.target.value)} />
      </label>
      <label>
        Ghi chu
        <textarea value={formState.note} onChange={(event) => updateField("note", event.target.value)} />
      </label>
      <label>
        So du hien tai
        <input value={formState.opening_balance} disabled readOnly />
      </label>
      <label>
        Tong mua
        <input value={formState.total_sales} disabled readOnly />
      </label>
      {formError ? <p className="form-error">{formError}</p> : null}
      <div className="form-actions">
        <Link className="secondary-link" to={`/customers/${customer.id}`}>
          Huy
        </Link>
        <button type="submit" disabled={updateCustomer.isPending}>
          {updateCustomer.isPending ? "Dang luu" : "Luu khach hang"}
        </button>
      </div>
    </form>
  );
}
