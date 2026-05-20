import { apiRequest } from "./client";
import type {
  CustomerDebtReportRow,
  DashboardSummary,
  InventorySummaryRow,
  ReturnsSummaryReport,
  SalesSummaryReport,
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

export function getCustomerDebtReport() {
  return apiRequest<CustomerDebtReportRow[]>("/reports/customer-debts");
}

export function getInventorySummaryReport() {
  return apiRequest<InventorySummaryRow[]>("/reports/inventory-summary");
}

export function getSalesSummaryReport(range: DateRange) {
  return apiRequest<SalesSummaryReport>(`/reports/sales-summary${dateRangeQuery(range)}`);
}

export function getReturnsSummaryReport(range: DateRange) {
  return apiRequest<ReturnsSummaryReport>(`/reports/returns-summary${dateRangeQuery(range)}`);
}
