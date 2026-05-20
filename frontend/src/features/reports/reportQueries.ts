import { useQuery } from "@tanstack/react-query";

import {
  getCustomerDebtReport,
  getDashboardSummary,
  getInventorySummaryReport,
  getReturnsSummaryReport,
  getSalesSummaryReport,
} from "../../api/reports";

export const reportKeys = {
  all: ["reports"] as const,
  dashboard: () => [...reportKeys.all, "dashboard-summary"] as const,
  customerDebts: () => [...reportKeys.all, "customer-debts"] as const,
  inventorySummary: () => [...reportKeys.all, "inventory-summary"] as const,
  salesSummary: (dateFrom: string, dateTo: string) => [...reportKeys.all, "sales-summary", { dateFrom, dateTo }] as const,
  returnsSummary: (dateFrom: string, dateTo: string) => [...reportKeys.all, "returns-summary", { dateFrom, dateTo }] as const,
};

export function useDashboardSummary() {
  return useQuery({
    queryKey: reportKeys.dashboard(),
    queryFn: getDashboardSummary,
  });
}

export function useCustomerDebtReport() {
  return useQuery({
    queryKey: reportKeys.customerDebts(),
    queryFn: getCustomerDebtReport,
  });
}

export function useInventorySummaryReport() {
  return useQuery({
    queryKey: reportKeys.inventorySummary(),
    queryFn: getInventorySummaryReport,
  });
}

export function useSalesSummaryReport(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: reportKeys.salesSummary(dateFrom, dateTo),
    queryFn: () => getSalesSummaryReport({ dateFrom, dateTo }),
  });
}

export function useReturnsSummaryReport(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: reportKeys.returnsSummary(dateFrom, dateTo),
    queryFn: () => getReturnsSummaryReport({ dateFrom, dateTo }),
  });
}
