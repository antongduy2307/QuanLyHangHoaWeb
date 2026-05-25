import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createOrder, deleteOrder, getOrder, listOrderQuantitySummary, listOrders, markOrderPrepared } from "../../api/orders";
import type { OrderCreatePayload } from "../../api/types";
import { customerKeys } from "../customers/customerQueries";
import { productKeys } from "../inventory/productQueries";

export const orderKeys = {
  all: ["orders"] as const,
  list: () => [...orderKeys.all, "list"] as const,
  quantitySummary: () => [...orderKeys.all, "quantity-summary"] as const,
  detail: (orderId: number) => [...orderKeys.all, orderId] as const,
};

export function useOrders() {
  return useQuery({
    queryKey: orderKeys.list(),
    queryFn: () => listOrders(),
  });
}

export function useOrderQuantitySummary() {
  return useQuery({
    queryKey: orderKeys.quantitySummary(),
    queryFn: () => listOrderQuantitySummary(),
  });
}

export function useOrder(orderId: number, enabled = true) {
  return useQuery({
    queryKey: orderKeys.detail(orderId),
    queryFn: () => getOrder(orderId),
    enabled,
  });
}

function useInvalidateOrderData() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: orderKeys.all }),
      queryClient.invalidateQueries({ queryKey: customerKeys.all }),
      queryClient.invalidateQueries({ queryKey: productKeys.all }),
    ]);
  };
}

export function useCreateOrder() {
  const invalidateOrders = useInvalidateOrderData();
  return useMutation({
    mutationFn: (payload: OrderCreatePayload) => createOrder(payload),
    onSuccess: invalidateOrders,
  });
}

export function useDeleteOrder(orderId: number) {
  const invalidateOrders = useInvalidateOrderData();
  return useMutation({
    mutationFn: () => deleteOrder(orderId),
    onSuccess: invalidateOrders,
  });
}

export function useMarkOrderPrepared(orderId: number) {
  const invalidateOrders = useInvalidateOrderData();
  return useMutation({
    mutationFn: (prepared: boolean) => markOrderPrepared(orderId, prepared),
    onSuccess: invalidateOrders,
  });
}
