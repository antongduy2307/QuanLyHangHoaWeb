import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createInvoice, deleteInvoice, getInvoice, listInvoices, updateInvoice } from "../../api/sales";
import type { InvoiceCreatePayload } from "../../api/types";
import { customerKeys } from "../customers/customerQueries";
import { productKeys } from "../inventory/productQueries";

export const invoiceKeys = {
  all: ["invoices"] as const,
  list: () => [...invoiceKeys.all, "list"] as const,
  detail: (invoiceId: number) => [...invoiceKeys.all, invoiceId] as const,
};

export function useInvoices() {
  return useQuery({
    queryKey: invoiceKeys.list(),
    queryFn: listInvoices,
  });
}

export function useInvoice(invoiceId: number) {
  return useQuery({
    queryKey: invoiceKeys.detail(invoiceId),
    queryFn: () => getInvoice(invoiceId),
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: InvoiceCreatePayload) => createInvoice(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: invoiceKeys.all }),
        queryClient.invalidateQueries({ queryKey: productKeys.all }),
        queryClient.invalidateQueries({ queryKey: customerKeys.all }),
      ]);
    },
  });
}

function useInvalidateInvoiceSideEffects(invoiceId?: number) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all }),
      invoiceId ? queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(invoiceId) }) : Promise.resolve(),
      queryClient.invalidateQueries({ queryKey: productKeys.all }),
      queryClient.invalidateQueries({ queryKey: customerKeys.all }),
    ]);
  };
}

export function useUpdateInvoice(invoiceId: number) {
  const invalidateInvoice = useInvalidateInvoiceSideEffects(invoiceId);
  return useMutation({
    mutationFn: (payload: InvoiceCreatePayload) => updateInvoice(invoiceId, payload),
    onSuccess: invalidateInvoice,
  });
}

export function useDeleteInvoice(invoiceId: number) {
  const invalidateInvoice = useInvalidateInvoiceSideEffects(invoiceId);
  return useMutation({
    mutationFn: () => deleteInvoice(invoiceId),
    onSuccess: invalidateInvoice,
  });
}
