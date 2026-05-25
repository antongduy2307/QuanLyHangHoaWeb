import type { Customer, CustomerCreatePayload, CustomerUpdatePayload } from "../../api/types";

export type CustomerFormState = {
  customer_name: string;
  phone: string;
  address: string;
  note: string;
  opening_balance: string;
  total_sales: string;
};

export type CustomerFormErrors = Partial<Record<"customer_name" | "opening_balance" | "total_sales", string>>;

const decimalPattern = /^-?(?:\d+)(?:\.\d{1,2})?$/;
export const initialCustomerFormState: CustomerFormState = {
  customer_name: "",
  phone: "",
  address: "",
  note: "",
  opening_balance: "0",
  total_sales: "0",
};

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function validateCustomerForm(state: CustomerFormState): CustomerFormErrors {
  const errors: CustomerFormErrors = {};
  if (!state.customer_name.trim()) {
    errors.customer_name = "Tên khách hàng là bắt buộc.";
  }
  if (!decimalPattern.test(state.opening_balance.trim())) {
    errors.opening_balance = "Số dư ban đầu phải là số hợp lệ.";
  }
  return errors;
}

export function toCustomerCreatePayload(state: CustomerFormState): CustomerCreatePayload {
  return {
    customer_name: state.customer_name.trim(),
    phone: optionalText(state.phone),
    address: optionalText(state.address),
    note: optionalText(state.note),
    opening_balance: state.opening_balance.trim() || "0",
  };
}

export function customerToEditableFormState(customer: Customer): CustomerFormState {
  return {
    customer_name: customer.customer_name,
    phone: customer.phone ?? "",
    address: customer.address ?? "",
    note: customer.note ?? "",
    opening_balance: customer.current_balance,
    total_sales: customer.total_sales,
  };
}

export function validateCustomerEditableForm(state: CustomerFormState): Pick<CustomerFormErrors, "customer_name"> {
  const errors: Pick<CustomerFormErrors, "customer_name"> = {};
  if (!state.customer_name.trim()) {
    errors.customer_name = "Tên khách hàng là bắt buộc.";
  }
  return errors;
}

export function toCustomerUpdatePayload(state: CustomerFormState): CustomerUpdatePayload {
  return {
    customer_name: state.customer_name.trim(),
    phone: optionalText(state.phone),
    address: optionalText(state.address),
    note: optionalText(state.note),
  };
}
