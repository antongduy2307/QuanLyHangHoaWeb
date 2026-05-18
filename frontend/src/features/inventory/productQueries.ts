import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createProduct, listProducts } from "../../api/inventory";
import type { ProductCreatePayload } from "../../api/types";

export const productKeys = {
  all: ["inventory", "products"] as const,
  list: (search: string) => [...productKeys.all, { search }] as const,
};

export function useProducts(search: string) {
  return useQuery({
    queryKey: productKeys.list(search),
    queryFn: () => listProducts({ search }),
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
