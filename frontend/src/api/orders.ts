import { apiRequest } from "./client";
import type { Order, OrderCreatePayload, OrderQuantitySummaryRow } from "./types";

export function listOrders() {
  return apiRequest<Order[]>("/orders");
}

export function getOrder(orderId: number) {
  return apiRequest<Order>(`/orders/${orderId}`);
}

export function createOrder(payload: OrderCreatePayload) {
  return apiRequest<Order>("/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteOrder(orderId: number) {
  return apiRequest<void>(`/orders/${orderId}`, {
    method: "DELETE",
  });
}

export function markOrderPrepared(orderId: number, prepared: boolean) {
  return apiRequest<Order>(`/orders/${orderId}/prepared`, {
    method: "POST",
    body: JSON.stringify({ prepared }),
  });
}

export function listOrderQuantitySummary() {
  return apiRequest<OrderQuantitySummaryRow[]>("/orders/quantity-summary");
}
