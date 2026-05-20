import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createProduct,
  decreaseStock,
  deleteProduct,
  getProduct,
  increaseStock,
  listProductMovements,
  listProducts,
  setStock,
  updateProduct,
} from "../../api/inventory";
import type { ProductCreatePayload, ProductUpdatePayload, StockAdjustmentPayload, StockSetPayload } from "../../api/types";

export const productKeys = {
  all: ["inventory", "products"] as const,
  list: (search: string, includeInactive: boolean) => [...productKeys.all, "list", { search, includeInactive }] as const,
  detail: (productId: number) => [...productKeys.all, "detail", productId] as const,
  movements: (productId: number) => [...productKeys.detail(productId), "movements"] as const,
};

export function useProducts(search: string, includeInactive = false) {
  return useQuery({
    queryKey: productKeys.list(search, includeInactive),
    queryFn: () => listProducts({ search, includeInactive }),
  });
}

export function useProduct(productId: number) {
  return useQuery({
    queryKey: productKeys.detail(productId),
    queryFn: () => getProduct(productId),
    enabled: Number.isInteger(productId) && productId > 0,
  });
}

export function useProductMovements(productId: number) {
  return useQuery({
    queryKey: productKeys.movements(productId),
    queryFn: () => listProductMovements(productId),
    enabled: Number.isInteger(productId) && productId > 0,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProductCreatePayload) => createProduct(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}

function useInvalidateProduct(productId: number) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: productKeys.all }),
      queryClient.invalidateQueries({ queryKey: productKeys.detail(productId) }),
      queryClient.invalidateQueries({ queryKey: productKeys.movements(productId) }),
    ]);
  };
}

export function useUpdateProduct(productId: number) {
  const invalidateProduct = useInvalidateProduct(productId);
  return useMutation({
    mutationFn: (payload: ProductUpdatePayload) => updateProduct(productId, payload),
    onSuccess: invalidateProduct,
  });
}

export function useDeleteProduct(productId: number) {
  const invalidateProduct = useInvalidateProduct(productId);
  return useMutation({
    mutationFn: () => deleteProduct(productId),
    onSuccess: invalidateProduct,
  });
}

export function useIncreaseStock(productId: number) {
  const invalidateProduct = useInvalidateProduct(productId);
  return useMutation({
    mutationFn: (payload: StockAdjustmentPayload) => increaseStock(productId, payload),
    onSuccess: invalidateProduct,
  });
}

export function useDecreaseStock(productId: number) {
  const invalidateProduct = useInvalidateProduct(productId);
  return useMutation({
    mutationFn: (payload: StockAdjustmentPayload) => decreaseStock(productId, payload),
    onSuccess: invalidateProduct,
  });
}

export function useSetStock(productId: number) {
  const invalidateProduct = useInvalidateProduct(productId);
  return useMutation({
    mutationFn: (payload: StockSetPayload) => setStock(productId, payload),
    onSuccess: invalidateProduct,
  });
}
