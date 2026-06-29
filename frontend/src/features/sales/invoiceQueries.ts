import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createInvoice, deleteInvoice, getInvoice, listInvoices, updateInvoice } from "../../api/sales";
import type { InvoiceCreatePayload } from "../../api/types";
import { customerKeys } from "../customers/customerQueries";
import { historyKeys } from "../history/historyQueries";
import { productKeys } from "../inventory/productQueries";
import { orderKeys } from "../orders/orderQueries";

export const invoiceKeys = {
  all: ["invoices"] as const,
  list: (search: string, dateFrom: string, dateTo: string, customerId?: number | null) =>
    [...invoiceKeys.all, "list", { search, dateFrom, dateTo, customerId: customerId ?? null }] as const,
  detail: (invoiceId: number) => [...invoiceKeys.all, invoiceId] as const,
};

export function useInvoices(search = "", dateFrom = "", dateTo = "", customerId?: number | null) {
  return useQuery({
    queryKey: invoiceKeys.list(search, dateFrom, dateTo, customerId),
    queryFn: () => listInvoices({ search, dateFrom, dateTo, customerId: customerId ?? undefined }),
  });
}

export function useInvoice(invoiceId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: invoiceKeys.detail(invoiceId),
    queryFn: () => getInvoice(invoiceId),
    enabled: options?.enabled ?? true,
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
        queryClient.invalidateQueries({ queryKey: orderKeys.all }),
        queryClient.invalidateQueries({ queryKey: historyKeys.all }),
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
      queryClient.invalidateQueries({ queryKey: orderKeys.all }),
      queryClient.invalidateQueries({ queryKey: historyKeys.all }),
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

export function useUpdateInvoiceById() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, payload }: { invoiceId: number; payload: InvoiceCreatePayload }) => updateInvoice(invoiceId, payload),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: invoiceKeys.all }),
        queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(variables.invoiceId) }),
        queryClient.invalidateQueries({ queryKey: productKeys.all }),
        queryClient.invalidateQueries({ queryKey: customerKeys.all }),
        queryClient.invalidateQueries({ queryKey: orderKeys.all }),
        queryClient.invalidateQueries({ queryKey: historyKeys.all }),
      ]);
    },
  });
}

export function useDeleteInvoice(invoiceId: number) {
  const invalidateInvoice = useInvalidateInvoiceSideEffects(invoiceId);
  return useMutation({
    mutationFn: () => deleteInvoice(invoiceId),
    onSuccess: invalidateInvoice,
  });
}
