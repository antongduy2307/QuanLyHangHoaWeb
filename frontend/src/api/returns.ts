import { apiRequest } from "./client";
import type { ReturnInvoice, ReturnInvoiceCreatePayload } from "./types";

export function listReturns() {
  return apiRequest<ReturnInvoice[]>("/returns");
}

export function getReturn(returnId: number) {
  return apiRequest<ReturnInvoice>(`/returns/${returnId}`);
}

export function createReturn(payload: ReturnInvoiceCreatePayload) {
  return apiRequest<ReturnInvoice>("/returns", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateReturn(returnId: number, payload: ReturnInvoiceCreatePayload) {
  return apiRequest<ReturnInvoice>(`/returns/${returnId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteReturn(returnId: number) {
  return apiRequest<void>(`/returns/${returnId}`, {
    method: "DELETE",
  });
}
