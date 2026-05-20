import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createReturn, deleteReturn, getReturn, listReturns, updateReturn } from "../../api/returns";
import type { ReturnInvoiceCreatePayload } from "../../api/types";
import { customerKeys } from "../customers/customerQueries";
import { productKeys } from "../inventory/productQueries";
import { invoiceKeys } from "../sales/invoiceQueries";

export const returnKeys = {
  all: ["returns"] as const,
  list: (search: string, dateFrom: string, dateTo: string) =>
    [...returnKeys.all, "list", { search, dateFrom, dateTo }] as const,
  detail: (returnId: number) => [...returnKeys.all, returnId] as const,
};

export function useReturns(search = "", dateFrom = "", dateTo = "") {
  return useQuery({
    queryKey: returnKeys.list(search, dateFrom, dateTo),
    queryFn: () => listReturns({ search, dateFrom, dateTo }),
  });
}

export function useReturn(returnId: number) {
  return useQuery({
    queryKey: returnKeys.detail(returnId),
    queryFn: () => getReturn(returnId),
  });
}

export function useCreateReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReturnInvoiceCreatePayload) => createReturn(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: returnKeys.all }),
        queryClient.invalidateQueries({ queryKey: productKeys.all }),
        queryClient.invalidateQueries({ queryKey: customerKeys.all }),
        queryClient.invalidateQueries({ queryKey: invoiceKeys.all }),
      ]);
    },
  });
}

function useInvalidateReturnSideEffects(returnId?: number) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: returnKeys.all }),
      returnId ? queryClient.invalidateQueries({ queryKey: returnKeys.detail(returnId) }) : Promise.resolve(),
      queryClient.invalidateQueries({ queryKey: productKeys.all }),
      queryClient.invalidateQueries({ queryKey: customerKeys.all }),
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all }),
    ]);
  };
}

export function useUpdateReturn(returnId: number) {
  const invalidateReturn = useInvalidateReturnSideEffects(returnId);
  return useMutation({
    mutationFn: (payload: ReturnInvoiceCreatePayload) => updateReturn(returnId, payload),
    onSuccess: invalidateReturn,
  });
}

export function useDeleteReturn(returnId: number) {
  const invalidateReturn = useInvalidateReturnSideEffects(returnId);
  return useMutation({
    mutationFn: () => deleteReturn(returnId),
    onSuccess: invalidateReturn,
  });
}
