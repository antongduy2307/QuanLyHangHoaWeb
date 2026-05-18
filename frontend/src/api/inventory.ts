import { apiRequest } from "./client";
import type { InventoryBalance, Product, ProductCreatePayload } from "./types";

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
