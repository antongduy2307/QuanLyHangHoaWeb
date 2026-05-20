import { apiRequest } from "./client";
import type { ReturnInvoice, ReturnInvoiceCreatePayload } from "./types";

type ListReturnsParams = {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
};

export function listReturns(params: ListReturnsParams = {}) {
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
  return apiRequest<ReturnInvoice[]>(queryString ? `/returns?${queryString}` : "/returns");
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
