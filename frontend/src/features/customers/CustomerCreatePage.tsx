import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { isApiError } from "../../api/errors";
import { PageHeader } from "../../components/PageHeader";
import { initialCustomerFormState, toCustomerCreatePayload, validateCustomerForm, type CustomerFormState } from "./customerSchemas";
import { useCreateCustomer } from "./customerQueries";

export function CustomerCreatePage() {
  const [formState, setFormState] = useState<CustomerFormState>(initialCustomerFormState);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const createCustomer = useCreateCustomer();
  const navigate = useNavigate();

  function updateField(field: keyof CustomerFormState, value: string) {
    setFormState((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const errors = validateCustomerForm(formState);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      await createCustomer.mutateAsync(toCustomerCreatePayload(formState));
      navigate("/customers");
    } catch (error) {
      setFormError(isApiError(error) ? error.message : "Khong the tao khach hang.");
    }
  }

  return (
    <>
      <PageHeader title="Tạo khách hàng" description="Tao ho so khach hang va so du ban dau neu co." />
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
          So du ban dau
          <input
            inputMode="decimal"
            value={formState.opening_balance}
            onChange={(event) => updateField("opening_balance", event.target.value)}
          />
          {fieldErrors.opening_balance ? <span className="field-error">{fieldErrors.opening_balance}</span> : null}
        </label>
        <label>
          Tong mua
          <input
            inputMode="decimal"
            value={formState.total_sales}
            onChange={(event) => updateField("total_sales", event.target.value)}
          />
          {fieldErrors.total_sales ? <span className="field-error">{fieldErrors.total_sales}</span> : null}
        </label>
        {formError ? <p className="form-error">{formError}</p> : null}
        <div className="form-actions">
          <Link className="secondary-link" to="/customers">
            Huy
          </Link>
          <button type="submit" disabled={createCustomer.isPending}>
            {createCustomer.isPending ? "Dang tao" : "Tạo khách hàng"}
          </button>
        </div>
      </form>
    </>
  );
}
