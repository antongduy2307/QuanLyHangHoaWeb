import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { isApiError } from "../../api/errors";
import type { HistoryEvent, SalesTimeseriesBucket, TopProductReportRow } from "../../api/types";
import { formatDateTime } from "../../domain/dates";
import { formatMoney } from "../../domain/money";
import { InventoryModuleShell } from "../inventory/InventoryModuleShell";
import {
  historyEventTypeLabel,
  historyStatusLabel,
  historyValueSummary,
  resolveHistoryOpenLink,
} from "../history/historyPresentation";
import { useHistory } from "../history/historyQueries";
import { useDashboardOverview, useSalesTimeseriesReport, useTopProductsReport } from "../reports/reportQueries";

const periodOptions = [
  { value: "this_month", label: "Th\u00e1ng n\u00e0y", granularity: "day" },
  { value: "last_month", label: "Th\u00e1ng tr\u01b0\u1edbc", granularity: "day" },
] as const;

type PeriodOption = (typeof periodOptions)[number];

type RevenueTick = {
  label: string;
  value: number;
};

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="dashboard-overview-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function chartMax(buckets: SalesTimeseriesBucket[]) {
  return buckets.reduce((max, bucket) => Math.max(max, Number(bucket.sales_total || "0")), 0);
}

function sortTopProductsByRevenue(rows: TopProductReportRow[]) {
  return [...rows].sort((left, right) => Number(right.total_revenue) - Number(left.total_revenue));
}

function recentActivitySubject(event: HistoryEvent) {
  if (event.customer_name && event.product_name) {
    return `${event.customer_name} / ${event.product_name}`;
  }
  return event.customer_name || event.product_name || "-";
}

function recentActivityReference(event: HistoryEvent) {
  return event.code || (event.source_id ? `#${event.source_id}` : `#${event.event_id}`);
}

function formatCompactMoney(value: number) {
  return value.toLocaleString("vi-VN", {
    maximumFractionDigits: 0,
  });
}

function roundedScaleCeiling(value: number) {
  if (value <= 0) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  let rounded = 10;
  if (normalized <= 2) rounded = 2;
  else if (normalized <= 5) rounded = 5;
  return rounded * magnitude;
}

function revenueTicks(maxRevenue: number): RevenueTick[] {
  const ceiling = roundedScaleCeiling(maxRevenue);
  return Array.from({ length: 5 }, (_, index) => {
    const fraction = (4 - index) / 4;
    const value = ceiling * fraction;
    return {
      value,
      label: value === 0 ? "0" : formatCompactMoney(value),
    };
  });
}

function chartDayLabel(label: string) {
  const dayMatch = label.match(/(\d{4})-(\d{2})-(\d{2})$/);
  if (dayMatch) {
    return dayMatch[3];
  }
  const shortMatch = label.match(/^(\d{2}):\d{2}$/);
  if (shortMatch) {
    return shortMatch[1];
  }
  return label;
}

export function DashboardPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption["value"]>("this_month");
  const overviewQuery = useDashboardOverview();
  const selectedOption = periodOptions.find((option) => option.value === selectedPeriod) ?? periodOptions[0];
  const timeseriesQuery = useSalesTimeseriesReport(selectedOption.value, selectedOption.granularity);
  const topProductsQuery = useTopProductsReport(selectedOption.value, "revenue", 10);
  const recentActivityQuery = useHistory("", "", "", "", undefined, undefined, 1, 8);

  const overviewErrorMessage = isApiError(overviewQuery.error)
    ? overviewQuery.error.message
    : "Kh\u00f4ng th\u1ec3 t\u1ea3i d\u1eef li\u1ec7u t\u1ed5ng quan.";
  const timeseriesErrorMessage = isApiError(timeseriesQuery.error)
    ? timeseriesQuery.error.message
    : "Kh\u00f4ng th\u1ec3 t\u1ea3i d\u1eef li\u1ec7u doanh thu theo th\u1eddi gian.";
  const topProductsErrorMessage = isApiError(topProductsQuery.error)
    ? topProductsQuery.error.message
    : "Kh\u00f4ng th\u1ec3 t\u1ea3i danh s\u00e1ch h\u00e0ng b\u00e1n ch\u1ea1y.";
  const recentActivityErrorMessage = isApiError(recentActivityQuery.error)
    ? recentActivityQuery.error.message
    : "Kh\u00f4ng th\u1ec3 t\u1ea3i ho\u1ea1t \u0111\u1ed9ng g\u1ea7n \u0111\u00e2y.";

  const isEmpty =
    overviewQuery.isSuccess
    && overviewQuery.data.today_invoice_count === 0
    && overviewQuery.data.today_sales_total === "0"
    && overviewQuery.data.today_return_count === 0
    && overviewQuery.data.today_return_total === "0"
    && overviewQuery.data.this_month_sales_total === "0"
    && overviewQuery.data.last_month_sales_total === "0"
    && overviewQuery.data.last_7_days_sales_total === "0"
    && overviewQuery.data.current_customer_debt === "0"
    && overviewQuery.data.positive_debt_customer_count === 0;

  const bucketData = timeseriesQuery.data?.buckets;
  const buckets = bucketData ?? [];
  const maxSales = useMemo(() => chartMax(bucketData ?? []), [bucketData]);
  const topProducts = useMemo(() => sortTopProductsByRevenue(topProductsQuery.data ?? []), [topProductsQuery.data]);
  const recentActivity = recentActivityQuery.data?.items ?? [];
  const chartWidth = `${Math.max(buckets.length, 10) * 46}px`;
  const isScrollableChart = buckets.length > 10;
  const yTicks = useMemo(() => revenueTicks(maxSales), [maxSales]);
  const scaleCeiling = roundedScaleCeiling(maxSales);

  return (
    <InventoryModuleShell
      title={"T\u1ed5ng quan"}
      description={"Theo d\u00f5i nhanh k\u1ebft qu\u1ea3 b\u00e1n h\u00e0ng, tr\u1ea3 h\u00e0ng v\u00e0 c\u00f4ng n\u1ee3 t\u1eeb m\u1ed9t m\u00e0n h\u00ecnh v\u1eadn h\u00e0nh."}
      contentClassName="dashboard-layout"
      compactHero
    >
      <section className="dashboard-overview-panel" aria-label={"K\u1ebft qu\u1ea3 b\u00e1n h\u00e0ng h\u00f4m nay"}>
        <div className="dashboard-overview-panel__header">
          <div>
            <p className="inventory-subtext">{"B\u1ea3ng \u0111i\u1ec1u khi\u1ec3n"}</p>
            <h2>{"K\u1ebft qu\u1ea3 b\u00e1n h\u00e0ng h\u00f4m nay"}</h2>
          </div>
          <span className="dashboard-overview-panel__badge">{"T\u1ed5ng quan"}</span>
        </div>

        {overviewQuery.isLoading ? <p className="state-message">{"\u0110ang t\u1ea3i t\u1ed5ng quan..."}</p> : null}
        {overviewQuery.isError ? <p className="state-message error-message">{overviewErrorMessage}</p> : null}
        {isEmpty ? <p className="state-message">{"Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u v\u1eadn h\u00e0nh \u0111\u1ec3 hi\u1ec3n th\u1ecb."}</p> : null}

        {overviewQuery.isSuccess && !isEmpty ? (
          <section className="dashboard-overview-grid" aria-label={"C\u00e1c ch\u1ec9 s\u1ed1 t\u1ed5ng quan"}>
            <MetricCard label={"S\u1ed1 h\u00f3a \u0111\u01a1n h\u00f4m nay"} value={overviewQuery.data.today_invoice_count} />
            <MetricCard label={"Doanh thu h\u00f4m nay"} value={formatMoney(overviewQuery.data.today_sales_total)} />
            <MetricCard label={"S\u1ed1 phi\u1ebfu tr\u1ea3 h\u00e0ng h\u00f4m nay"} value={overviewQuery.data.today_return_count} />
            <MetricCard label={"Ti\u1ec1n tr\u1ea3 h\u00e0ng h\u00f4m nay"} value={formatMoney(overviewQuery.data.today_return_total)} />
            <MetricCard label={"Doanh thu 7 ng\u00e0y qua"} value={formatMoney(overviewQuery.data.last_7_days_sales_total)} />
            <MetricCard label={"Doanh thu th\u00e1ng n\u00e0y"} value={formatMoney(overviewQuery.data.this_month_sales_total)} />
            <MetricCard label={"Doanh thu th\u00e1ng tr\u01b0\u1edbc"} value={formatMoney(overviewQuery.data.last_month_sales_total)} />
            <MetricCard label={"T\u1ed5ng c\u00f4ng n\u1ee3 hi\u1ec7n t\u1ea1i"} value={formatMoney(overviewQuery.data.current_customer_debt)} />
          </section>
        ) : null}
      </section>

      <section className="dashboard-timeseries-panel" aria-label={"Doanh thu theo th\u1eddi gian"}>
        <div className="dashboard-timeseries-panel__header">
          <div>
            <p className="inventory-subtext">{"Bi\u1ec3u \u0111\u1ed3 doanh thu"}</p>
            <h2>{"Doanh thu theo th\u1eddi gian"}</h2>
          </div>
          <div className="dashboard-timeseries-filter" role="group" aria-label={"Ch\u1ecdn chu k\u1ef3 doanh thu"}>
            {periodOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={option.value === selectedPeriod ? "dashboard-period-button active" : "dashboard-period-button"}
                onClick={() => setSelectedPeriod(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {timeseriesQuery.isLoading ? <p className="state-message">{"\u0110ang t\u1ea3i doanh thu theo th\u1eddi gian..."}</p> : null}
        {timeseriesQuery.isError ? <p className="state-message error-message">{timeseriesErrorMessage}</p> : null}
        {timeseriesQuery.isSuccess && buckets.length === 0 ? (
          <p className="state-message">{"Ch\u01b0a c\u00f3 doanh thu trong chu k\u1ef3 \u0111\u01b0\u1ee3c ch\u1ecdn."}</p>
        ) : null}

        {timeseriesQuery.isSuccess && buckets.length > 0 ? (
          <div className="dashboard-revenue-chart-shell">
            <div
              className="dashboard-revenue-chart-scroll"
              data-testid="dashboard-revenue-scroll"
              data-scrollable={isScrollableChart ? "true" : "false"}
            >
              <div className="dashboard-revenue-chart" style={{ width: chartWidth }}>
                <div className="dashboard-revenue-chart__y-axis">
                  {yTicks.map((tick) => (
                    <span key={tick.value}>{tick.label}</span>
                  ))}
                </div>

                <div className="dashboard-revenue-chart__plot">
                  {yTicks.map((tick) => {
                    const position = maxSales > 0 ? 100 - (tick.value / scaleCeiling) * 100 : 100;
                    return (
                      <div
                        key={tick.value}
                        className="dashboard-revenue-chart__grid-line"
                        style={{ bottom: `${position}%` }}
                      />
                    );
                  })}

                  <div className="dashboard-revenue-chart__columns">
                    {buckets.map((bucket) => {
                      const numericSales = Number(bucket.sales_total || "0");
                      const heightPercent = maxSales > 0 ? `${(numericSales / scaleCeiling) * 100}%` : "0%";
                      return (
                        <div
                          className="dashboard-revenue-chart__slot"
                          key={`${bucket.start_datetime}-${bucket.end_datetime}`}
                          data-testid="dashboard-revenue-bar"
                        >
                          <div className="dashboard-revenue-chart__bar-wrap">
                            <div className="dashboard-revenue-chart__bar" style={{ height: heightPercent }} />
                          </div>
                          <strong className="dashboard-revenue-chart__label">{chartDayLabel(bucket.label)}</strong>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="dashboard-top-products-panel" aria-label={"Top h\u00e0ng b\u00e1n ch\u1ea1y"}>
        <div className="dashboard-timeseries-panel__header">
          <div>
            <p className="inventory-subtext">{"X\u1ebfp h\u1ea1ng doanh thu"}</p>
            <h2>{"Top h\u00e0ng b\u00e1n ch\u1ea1y"}</h2>
          </div>
          <span className="dashboard-overview-panel__badge">{selectedOption.label}</span>
        </div>

        {topProductsQuery.isLoading ? <p className="state-message">{"\u0110ang t\u1ea3i top h\u00e0ng b\u00e1n ch\u1ea1y..."}</p> : null}
        {topProductsQuery.isError ? <p className="state-message error-message">{topProductsErrorMessage}</p> : null}
        {topProductsQuery.isSuccess && topProducts.length === 0 ? (
          <p className="state-message">{"Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u h\u00e0ng b\u00e1n ch\u1ea1y trong chu k\u1ef3 \u0111\u01b0\u1ee3c ch\u1ecdn."}</p>
        ) : null}

        {topProductsQuery.isSuccess && topProducts.length > 0 ? (
          <div className="dashboard-top-products-table-wrap">
            <table className="data-table dashboard-top-products-table">
              <thead>
                <tr>
                  <th>{"H\u1ea1ng"}</th>
                  <th>{"M\u00e3 h\u00e0ng"}</th>
                  <th>{"T\u00ean h\u00e0ng"}</th>
                  <th>{"\u0110\u01a1n v\u1ecb"}</th>
                  <th>{"S\u1ed1 l\u01b0\u1ee3ng"}</th>
                  <th>{"Doanh thu"}</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((row, index) => (
                  <tr key={`${row.product_id}-${row.unit_type}`}>
                    <td>{index + 1}</td>
                    <td>{row.product_code}</td>
                    <td>{row.product_name}</td>
                    <td>{row.unit_type}</td>
                    <td>{row.total_quantity}</td>
                    <td>{formatMoney(row.total_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="dashboard-top-products-panel" aria-label={"Ho\u1ea1t \u0111\u1ed9ng g\u1ea7n \u0111\u00e2y"}>
        <div className="dashboard-timeseries-panel__header">
          <div>
            <p className="inventory-subtext">{"Nh\u1eadt k\u00fd giao d\u1ecbch"}</p>
            <h2>{"Ho\u1ea1t \u0111\u1ed9ng g\u1ea7n \u0111\u00e2y"}</h2>
          </div>
          <span className="dashboard-overview-panel__badge">{"8 m\u1ee5c m\u1edbi nh\u1ea5t"}</span>
        </div>

        {recentActivityQuery.isLoading ? <p className="state-message">{"\u0110ang t\u1ea3i ho\u1ea1t \u0111\u1ed9ng g\u1ea7n \u0111\u00e2y..."}</p> : null}
        {recentActivityQuery.isError ? <p className="state-message error-message">{recentActivityErrorMessage}</p> : null}
        {recentActivityQuery.isSuccess && recentActivity.length === 0 ? (
          <p className="state-message">{"Ch\u01b0a c\u00f3 ho\u1ea1t \u0111\u1ed9ng g\u1ea7n \u0111\u00e2y."}</p>
        ) : null}

        {recentActivityQuery.isSuccess && recentActivity.length > 0 ? (
          <div className="dashboard-top-products-table-wrap">
            <table className="data-table dashboard-top-products-table dashboard-activity-table">
              <thead>
                <tr>
                  <th>{"Th\u1eddi gian"}</th>
                  <th>{"Lo\u1ea1i"}</th>
                  <th>{"M\u00e3 / tham chi\u1ebfu"}</th>
                  <th>{"Kh\u00e1ch h\u00e0ng / s\u1ea3n ph\u1ea9m"}</th>
                  <th>{"Gi\u00e1 tr\u1ecb / s\u1ed1 l\u01b0\u1ee3ng"}</th>
                  <th>{"Tr\u1ea1ng th\u00e1i"}</th>
                  <th>{"M\u1edf"}</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((event) => {
                  const openLink = resolveHistoryOpenLink(event);
                  const valueLines = historyValueSummary(event);
                  return (
                    <tr key={`${event.event_type}-${event.event_id}-${event.source_type ?? "none"}-${event.source_id ?? "none"}`}>
                      <td>{formatDateTime(event.event_datetime)}</td>
                      <td>{historyEventTypeLabel(event.event_type)}</td>
                      <td>{recentActivityReference(event)}</td>
                      <td>{recentActivitySubject(event)}</td>
                      <td>
                        <div className="dashboard-activity-value">
                          {valueLines.map((line) => (
                            <span key={line}>{line}</span>
                          ))}
                        </div>
                      </td>
                      <td>{historyStatusLabel(event)}</td>
                      <td>
                        {openLink ? (
                          <Link className="inventory-ghost-button dashboard-activity-link" to={openLink}>
                            {"M\u1edf"}
                          </Link>
                        ) : (
                          <span className="history-open-placeholder">{"-"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </InventoryModuleShell>
  );
}
