import { useState } from "react";

import { isApiError } from "../../api/errors";
import { PageHeader } from "../../components/PageHeader";
import { unitLabel } from "../../domain/documents";
import { formatMoney } from "../../domain/money";
import {
  useCustomerDebtReport,
  useInventorySummaryReport,
  useReturnsSummaryReport,
  useSalesSummaryReport,
} from "./reportQueries";

function queryErrorMessage(error: unknown, fallback: string) {
  return isApiError(error) ? error.message : fallback;
}

export function ReportsPlaceholder() {
  const [salesDateFrom, setSalesDateFrom] = useState("");
  const [salesDateTo, setSalesDateTo] = useState("");
  const [returnsDateFrom, setReturnsDateFrom] = useState("");
  const [returnsDateTo, setReturnsDateTo] = useState("");
  const customerDebtsQuery = useCustomerDebtReport();
  const inventoryQuery = useInventorySummaryReport();
  const salesSummaryQuery = useSalesSummaryReport(salesDateFrom, salesDateTo);
  const returnsSummaryQuery = useReturnsSummaryReport(returnsDateFrom, returnsDateTo);

  return (
    <>
      <PageHeader title="Bao cao" description="Bao cao van hanh doc-only cho cong no, ton kho, ban hang va tra hang." />

      <section className="form-panel" aria-label="Bo loc bao cao ban hang">
        <h2>Ban hang</h2>
        <div className="toolbar">
          <label>
            Tu ngay
            <input type="date" value={salesDateFrom} onChange={(event) => setSalesDateFrom(event.target.value)} />
          </label>
          <label>
            Den ngay
            <input type="date" value={salesDateTo} onChange={(event) => setSalesDateTo(event.target.value)} />
          </label>
        </div>
        {salesSummaryQuery.isLoading ? <p className="state-message">Dang tai bao cao ban hang...</p> : null}
        {salesSummaryQuery.isError ? (
          <p className="state-message error-message">{queryErrorMessage(salesSummaryQuery.error, "Khong the tai bao cao ban hang.")}</p>
        ) : null}
        {salesSummaryQuery.isSuccess ? (
          <>
            <section className="summary-grid" aria-label="Tong hop ban hang">
              <div className="summary-card">
                <span>Tong doanh thu</span>
                <strong>{formatMoney(salesSummaryQuery.data.total_sales)}</strong>
              </div>
              <div className="summary-card">
                <span>Da thanh toan</span>
                <strong>{formatMoney(salesSummaryQuery.data.total_paid)}</strong>
              </div>
              <div className="summary-card">
                <span>So hoa don</span>
                <strong>{salesSummaryQuery.data.invoice_count}</strong>
              </div>
              <div className="summary-card">
                <span>Trung binh hoa don</span>
                <strong>{formatMoney(salesSummaryQuery.data.average_invoice_total)}</strong>
              </div>
            </section>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ngay</th>
                    <th>So hoa don</th>
                    <th>Doanh thu</th>
                    <th>Da thanh toan</th>
                  </tr>
                </thead>
                <tbody>
                  {salesSummaryQuery.data.by_day.map((row) => (
                    <tr key={row.date}>
                      <td>{row.date}</td>
                      <td>{row.invoice_count}</td>
                      <td>{formatMoney(row.total_sales)}</td>
                      <td>{formatMoney(row.total_paid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      <section className="form-panel" aria-label="Bo loc bao cao tra hang">
        <h2>Tra hang</h2>
        <div className="toolbar">
          <label>
            Tu ngay tra
            <input type="date" value={returnsDateFrom} onChange={(event) => setReturnsDateFrom(event.target.value)} />
          </label>
          <label>
            Den ngay tra
            <input type="date" value={returnsDateTo} onChange={(event) => setReturnsDateTo(event.target.value)} />
          </label>
        </div>
        {returnsSummaryQuery.isLoading ? <p className="state-message">Dang tai bao cao tra hang...</p> : null}
        {returnsSummaryQuery.isError ? (
          <p className="state-message error-message">{queryErrorMessage(returnsSummaryQuery.error, "Khong the tai bao cao tra hang.")}</p>
        ) : null}
        {returnsSummaryQuery.isSuccess ? (
          <>
            <section className="summary-grid" aria-label="Tong hop tra hang">
              <div className="summary-card">
                <span>Tong tien tra</span>
                <strong>{formatMoney(returnsSummaryQuery.data.total_returns)}</strong>
              </div>
              <div className="summary-card">
                <span>So phieu tra</span>
                <strong>{returnsSummaryQuery.data.return_count}</strong>
              </div>
            </section>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ngay</th>
                    <th>So phieu tra</th>
                    <th>Tong tien tra</th>
                  </tr>
                </thead>
                <tbody>
                  {returnsSummaryQuery.data.by_day.map((row) => (
                    <tr key={row.date}>
                      <td>{row.date}</td>
                      <td>{row.return_count}</td>
                      <td>{formatMoney(row.total_returns)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      <section className="form-panel" aria-label="Bao cao cong no khach hang">
        <h2>Cong no khach hang</h2>
        {customerDebtsQuery.isLoading ? <p className="state-message">Dang tai bao cao cong no...</p> : null}
        {customerDebtsQuery.isError ? (
          <p className="state-message error-message">{queryErrorMessage(customerDebtsQuery.error, "Khong the tai bao cao cong no.")}</p>
        ) : null}
        {customerDebtsQuery.isSuccess ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Khach hang</th>
                  <th>Dien thoai</th>
                  <th>Cong no</th>
                  <th>Tong mua</th>
                  <th>Trang thai</th>
                </tr>
              </thead>
              <tbody>
                {customerDebtsQuery.data.map((row) => (
                  <tr key={row.customer_id}>
                    <td>{row.customer_name}</td>
                    <td>{row.phone || "-"}</td>
                    <td>{formatMoney(row.current_balance)}</td>
                    <td>{formatMoney(row.total_sales)}</td>
                    <td>{row.is_active ? "Dang dung" : "Ngung dung"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="form-panel" aria-label="Bao cao ton kho">
        <h2>Ton kho</h2>
        {inventoryQuery.isLoading ? <p className="state-message">Dang tai bao cao ton kho...</p> : null}
        {inventoryQuery.isError ? (
          <p className="state-message error-message">{queryErrorMessage(inventoryQuery.error, "Khong the tai bao cao ton kho.")}</p>
        ) : null}
        {inventoryQuery.isSuccess ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ma hang</th>
                  <th>Ten hang</th>
                  <th>Kieu don vi</th>
                  <th>Ton hien tai</th>
                  <th>Gia dang bat</th>
                  <th>Trang thai</th>
                </tr>
              </thead>
              <tbody>
                {inventoryQuery.data.map((row) => (
                  <tr key={row.product_id}>
                    <td>{row.product_code_base}</td>
                    <td>{row.product_name}</td>
                    <td>{row.unit_mode}</td>
                    <td>{row.balance_value ? `${row.balance_value} ${row.balance_unit ? unitLabel(row.balance_unit) : ""}` : "-"}</td>
                    <td>
                      {row.prices
                        .filter((price) => price.is_enabled)
                        .map((price) => `${unitLabel(price.unit_type)}: ${formatMoney(price.price)}`)
                        .join(" | ") || "-"}
                    </td>
                    <td>{row.is_active ? "Dang dung" : "Ngung dung"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </>
  );
}
