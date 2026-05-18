import { apiRequest } from "./client";
import type { Customer, CustomerCreatePayload, CustomerLedgerRow, DebtPayment, DebtPaymentPayload, DebtPaymentResult } from "./types";

export type ListCustomersParams = {
  includeInactive?: boolean;
  search?: string;
  onlyPositiveDebt?: boolean;
};

export function listCustomers(params: ListCustomersParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.includeInactive) {
    searchParams.set("include_inactive", "true");
  }
  if (params.onlyPositiveDebt) {
    searchParams.set("only_positive_debt", "true");
  }
  if (params.search?.trim()) {
    searchParams.set("search", params.search.trim());
  }
  const queryString = searchParams.toString();
  return apiRequest<Customer[]>(`/customers${queryString ? `?${queryString}` : ""}`);
}

export function createCustomer(payload: CustomerCreatePayload) {
  return apiRequest<Customer>("/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCustomer(customerId: number) {
  return apiRequest<Customer>(`/customers/${customerId}`);
}

export function getCustomerLedger(customerId: number) {
  return apiRequest<CustomerLedgerRow[]>(`/customers/${customerId}/ledger`);
}

export function listDebtPayments(customerId: number) {
  return apiRequest<DebtPayment[]>(`/customers/${customerId}/debt-payments`);
}

export function createDebtPayment(customerId: number, payload: DebtPaymentPayload) {
  return apiRequest<DebtPaymentResult>(`/customers/${customerId}/debt-payments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateDebtPayment(customerId: number, paymentId: number, payload: DebtPaymentPayload) {
  return apiRequest<DebtPaymentResult>(`/customers/${customerId}/debt-payments/${paymentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteDebtPayment(customerId: number, paymentId: number) {
  return apiRequest<void>(`/customers/${customerId}/debt-payments/${paymentId}`, {
    method: "DELETE",
  });
}
