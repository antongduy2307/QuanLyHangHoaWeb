import { apiRequest } from "./client";
import type { Invoice, InvoiceCreatePayload } from "./types";

export function listInvoices() {
  return apiRequest<Invoice[]>("/sales/invoices");
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
