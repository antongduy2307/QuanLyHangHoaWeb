import { apiRequest } from "./client";
import type {
  InventoryBalance,
  InventoryMovement,
  Product,
  ProductCreatePayload,
  ProductDeleteResult,
  ProductUpdatePayload,
  StockAdjustmentPayload,
  StockSetPayload,
} from "./types";

export type ListProductsParams = {
  includeInactive?: boolean;
  search?: string;
};

export function listProducts(params: ListProductsParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.includeInactive) {
    searchParams.set("include_inactive", "true");
  }
  if (params.search?.trim()) {
    searchParams.set("search", params.search.trim());
  }
  const queryString = searchParams.toString();
  return apiRequest<Product[]>(`/inventory/products${queryString ? `?${queryString}` : ""}`);
}

export function createProduct(payload: ProductCreatePayload) {
  return apiRequest<Product>("/inventory/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getProduct(productId: number) {
  return apiRequest<Product>(`/inventory/products/${productId}`);
}

export function getProductBalance(productId: number) {
  return apiRequest<InventoryBalance>(`/inventory/products/${productId}/balance`);
}

export function listProductMovements(productId: number) {
  return apiRequest<InventoryMovement[]>(`/inventory/products/${productId}/movements`);
}

export function updateProduct(productId: number, payload: ProductUpdatePayload) {
  return apiRequest<Product>(`/inventory/products/${productId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteProduct(productId: number) {
  return apiRequest<ProductDeleteResult>(`/inventory/products/${productId}`, {
    method: "DELETE",
  });
}

export function increaseStock(productId: number, payload: StockAdjustmentPayload) {
  return apiRequest<InventoryBalance>(`/inventory/products/${productId}/stock/increase`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function decreaseStock(productId: number, payload: StockAdjustmentPayload) {
  return apiRequest<InventoryBalance>(`/inventory/products/${productId}/stock/decrease`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function setStock(productId: number, payload: StockSetPayload) {
  return apiRequest<InventoryBalance>(`/inventory/products/${productId}/stock/set`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
