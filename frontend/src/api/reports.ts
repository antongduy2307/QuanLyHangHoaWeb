import { apiRequest } from "./client";
import type {
  CustomerDebtReportRow,
  DashboardOverview,
  DashboardSummary,
  InventorySummaryRow,
  ReturnsSummaryReport,
  SalesSummaryReport,
  SalesTimeseriesReport,
  TopProductReportRow,
} from "./types";

type DateRange = {
  dateFrom?: string;
  dateTo?: string;
};

function dateRangeQuery({ dateFrom, dateTo }: DateRange) {
  const params = new URLSearchParams();
  if (dateFrom) {
    params.set("date_from", dateFrom);
  }
  if (dateTo) {
    params.set("date_to", dateTo);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function getDashboardSummary() {
  return apiRequest<DashboardSummary>("/reports/dashboard-summary");
}

export function getDashboardOverview() {
  return apiRequest<DashboardOverview>("/reports/overview");
}

export function getCustomerDebtReport() {
  return apiRequest<CustomerDebtReportRow[]>("/reports/customer-debts");
}

export function getInventorySummaryReport() {
  return apiRequest<InventorySummaryRow[]>("/reports/inventory-summary");
}

export function getSalesSummaryReport(range: DateRange) {
  return apiRequest<SalesSummaryReport>(`/reports/sales-summary${dateRangeQuery(range)}`);
}

export function getSalesTimeseriesReport(period: string, granularity: string) {
  const params = new URLSearchParams({ period, granularity });
  return apiRequest<SalesTimeseriesReport>(`/reports/sales-timeseries?${params.toString()}`);
}

export function getTopProductsReport(period: string, metric = "revenue", limit = 10) {
  const params = new URLSearchParams({ period, metric, limit: String(limit) });
  return apiRequest<TopProductReportRow[]>(`/reports/top-products?${params.toString()}`);
}

export function getReturnsSummaryReport(range: DateRange) {
  return apiRequest<ReturnsSummaryReport>(`/reports/returns-summary${dateRangeQuery(range)}`);
}
