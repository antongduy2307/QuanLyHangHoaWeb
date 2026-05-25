import { useQuery } from "@tanstack/react-query";

import {
  getCustomerDebtReport,
  getDashboardOverview,
  getDashboardSummary,
  getInventorySummaryReport,
  getReturnsSummaryReport,
  getSalesSummaryReport,
  getSalesTimeseriesReport,
  getTopProductsReport,
} from "../../api/reports";

export const reportKeys = {
  all: ["reports"] as const,
  dashboard: () => [...reportKeys.all, "dashboard-summary"] as const,
  overview: () => [...reportKeys.all, "overview"] as const,
  customerDebts: () => [...reportKeys.all, "customer-debts"] as const,
  inventorySummary: () => [...reportKeys.all, "inventory-summary"] as const,
  salesSummary: (dateFrom: string, dateTo: string) => [...reportKeys.all, "sales-summary", { dateFrom, dateTo }] as const,
  salesTimeseries: (period: string, granularity: string) => [...reportKeys.all, "sales-timeseries", { period, granularity }] as const,
  topProducts: (period: string, metric: string, limit: number) => [...reportKeys.all, "top-products", { period, metric, limit }] as const,
  returnsSummary: (dateFrom: string, dateTo: string) => [...reportKeys.all, "returns-summary", { dateFrom, dateTo }] as const,
};

export function useDashboardSummary() {
  return useQuery({
    queryKey: reportKeys.dashboard(),
    queryFn: getDashboardSummary,
  });
}

export function useDashboardOverview() {
  return useQuery({
    queryKey: reportKeys.overview(),
    queryFn: getDashboardOverview,
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

export function useSalesTimeseriesReport(period: string, granularity: string) {
  return useQuery({
    queryKey: reportKeys.salesTimeseries(period, granularity),
    queryFn: () => getSalesTimeseriesReport(period, granularity),
  });
}

export function useTopProductsReport(period: string, metric: string, limit = 10) {
  return useQuery({
    queryKey: reportKeys.topProducts(period, metric, limit),
    queryFn: () => getTopProductsReport(period, metric, limit),
  });
}

export function useReturnsSummaryReport(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: reportKeys.returnsSummary(dateFrom, dateTo),
    queryFn: () => getReturnsSummaryReport({ dateFrom, dateTo }),
  });
}
