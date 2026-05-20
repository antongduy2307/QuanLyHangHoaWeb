import { apiRequest } from "./client";
import type { Invoice, InvoiceCreatePayload } from "./types";

export type ListInvoicesParams = {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
};

export function listInvoices(params: ListInvoicesParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.search?.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.dateFrom) {
    searchParams.set("date_from", `${params.dateFrom}T00:00:00`);
  }
  if (params.dateTo) {
    searchParams.set("date_to", `${params.dateTo}T23:59:59`);
  }
  const queryString = searchParams.toString();
  return apiRequest<Invoice[]>(`/sales/invoices${queryString ? `?${queryString}` : ""}`);
}

export function getInvoice(invoiceId: number) {
  return apiRequest<Invoice>(`/sales/invoices/${invoiceId}`);
}

export function createInvoice(payload: InvoiceCreatePayload) {
  return apiRequest<Invoice>("/sales/invoices", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateInvoice(invoiceId: number, payload: InvoiceCreatePayload) {
  return apiRequest<Invoice>(`/sales/invoices/${invoiceId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteInvoice(invoiceId: number) {
  return apiRequest<void>(`/sales/invoices/${invoiceId}`, {
    method: "DELETE",
  });
}
