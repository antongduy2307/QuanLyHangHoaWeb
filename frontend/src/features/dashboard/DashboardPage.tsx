import { isApiError } from "../../api/errors";
import { PageHeader } from "../../components/PageHeader";
import { formatMoney } from "../../domain/money";
import { useDashboardSummary } from "../reports/reportQueries";

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function DashboardPage() {
  const summaryQuery = useDashboardSummary();
  const errorMessage = isApiError(summaryQuery.error) ? summaryQuery.error.message : "Khong the tai du lieu tong quan.";

  return (
    <>
      <PageHeader title="Tong quan" description="Cac chi so van hanh trong ngay va trong thang." />

      {summaryQuery.isLoading ? <p className="state-message">Dang tai tong quan...</p> : null}
      {summaryQuery.isError ? <p className="state-message error-message">{errorMessage}</p> : null}
      {summaryQuery.isSuccess ? (
        <section className="summary-grid" aria-label="Tong quan van hanh">
          <MetricCard label="Doanh thu hom nay" value={formatMoney(summaryQuery.data.today_sales_total)} />
          <MetricCard label="Doanh thu thang nay" value={formatMoney(summaryQuery.data.month_sales_total)} />
          <MetricCard label="Cong no hien tai" value={formatMoney(summaryQuery.data.total_customer_debt)} />
          <MetricCard label="Khach con no" value={summaryQuery.data.positive_debt_customer_count} />
          <MetricCard label="Hoa don hom nay" value={summaryQuery.data.invoice_count_today} />
          <MetricCard label="Tra hang hom nay" value={formatMoney(summaryQuery.data.today_return_total)} />
        </section>
      ) : null}
    </>
  );
}
