import { apiRequest } from "./client";
import type { HistoryEventType, HistoryListResponse } from "./types";

export type ListHistoryParams = {
  dateFrom?: string;
  dateTo?: string;
  eventType?: HistoryEventType | "";
  customerId?: number;
  productId?: number;
  search?: string;
  page?: number;
  pageSize?: number;
};

export function listHistory(params: ListHistoryParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.dateFrom) {
    searchParams.set("date_from", `${params.dateFrom}T00:00:00`);
  }
  if (params.dateTo) {
    searchParams.set("date_to", `${params.dateTo}T23:59:59`);
  }
  if (params.eventType) {
    searchParams.set("event_type", params.eventType);
  }
  if (params.customerId) {
    searchParams.set("customer_id", String(params.customerId));
  }
  if (params.productId) {
    searchParams.set("product_id", String(params.productId));
  }
  if (params.search?.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.page && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (params.pageSize && params.pageSize > 0) {
    searchParams.set("page_size", String(params.pageSize));
  }
  const queryString = searchParams.toString();
  return apiRequest<HistoryListResponse>(queryString ? `/history?${queryString}` : "/history");
}
