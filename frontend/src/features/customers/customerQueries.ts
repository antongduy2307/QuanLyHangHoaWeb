import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createCustomer,
  createDebtPayment,
  deleteDebtPayment,
  getCustomer,
  getCustomerLedger,
  listCustomers,
  listDebtPayments,
  updateDebtPayment,
} from "../../api/customers";
import type { CustomerCreatePayload, DebtPaymentPayload } from "../../api/types";

export const customerKeys = {
  all: ["customers"] as const,
  list: (search: string, onlyPositiveDebt: boolean) => [...customerKeys.all, { search, onlyPositiveDebt }] as const,
  detail: (customerId: number) => [...customerKeys.all, customerId] as const,
  ledger: (customerId: number) => [...customerKeys.detail(customerId), "ledger"] as const,
  debtPayments: (customerId: number) => [...customerKeys.detail(customerId), "debt-payments"] as const,
};

export function useCustomers(search: string, onlyPositiveDebt: boolean) {
  return useQuery({
    queryKey: customerKeys.list(search, onlyPositiveDebt),
    queryFn: () => listCustomers({ search, onlyPositiveDebt }),
  });
}

export function useCustomer(customerId: number) {
  return useQuery({
    queryKey: customerKeys.detail(customerId),
    queryFn: () => getCustomer(customerId),
  });
}

export function useCustomerLedger(customerId: number) {
  return useQuery({
    queryKey: customerKeys.ledger(customerId),
    queryFn: () => getCustomerLedger(customerId),
  });
}

export function useDebtPayments(customerId: number) {
  return useQuery({
    queryKey: customerKeys.debtPayments(customerId),
    queryFn: () => listDebtPayments(customerId),
  });
}

function useInvalidateCustomerDetail(customerId: number) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: customerKeys.all }),
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(customerId) }),
      queryClient.invalidateQueries({ queryKey: customerKeys.ledger(customerId) }),
      queryClient.invalidateQueries({ queryKey: customerKeys.debtPayments(customerId) }),
    ]);
  };
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CustomerCreatePayload) => createCustomer(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
}

export function useCreateDebtPayment(customerId: number) {
  const invalidateCustomerDetail = useInvalidateCustomerDetail(customerId);
  return useMutation({
    mutationFn: (payload: DebtPaymentPayload) => createDebtPayment(customerId, payload),
    onSuccess: invalidateCustomerDetail,
  });
}

export function useUpdateDebtPayment(customerId: number) {
  const invalidateCustomerDetail = useInvalidateCustomerDetail(customerId);
  return useMutation({
    mutationFn: ({ paymentId, payload }: { paymentId: number; payload: DebtPaymentPayload }) =>
      updateDebtPayment(customerId, paymentId, payload),
    onSuccess: invalidateCustomerDetail,
  });
}

export function useDeleteDebtPayment(customerId: number) {
  const invalidateCustomerDetail = useInvalidateCustomerDetail(customerId);
  return useMutation({
    mutationFn: (paymentId: number) => deleteDebtPayment(customerId, paymentId),
    onSuccess: invalidateCustomerDetail,
  });
}
