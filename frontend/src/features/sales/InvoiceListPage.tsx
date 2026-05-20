import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { isApiError } from "../../api/errors";
import { useAuth } from "../../auth/useAuth";
import { PageHeader } from "../../components/PageHeader";
import { formatDateTime } from "../../domain/dates";
import { invoiceStatusLabel } from "../../domain/documents";
import { formatMoney } from "../../domain/money";
import { useInvoices } from "./invoiceQueries";

const writeRoles = ["owner", "admin"] as const;

export function InvoiceListPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const location = useLocation();
  const locationState = location.state as { invoiceMessage?: string } | null;
  const invoicesQuery = useInvoices(search, dateFrom, dateTo);
  const errorMessage = isApiError(invoicesQuery.error) ? invoicesQuery.error.message : "Khong the tai danh sach hoa don.";
  const canCreate = user ? writeRoles.some((role) => role === user.role) : false;
  const invoices = invoicesQuery.data ?? [];

  return (
    <>
      <div className="page-title-row">
        <PageHeader title="Ban hang" description="Danh sach hoa don ban hang da ghi nhan." />
        {canCreate ? (
          <Link className="primary-link" to="/sales/invoices/new">
            Tao hoa don
          </Link>
        ) : null}
      </div>

      <section className="toolbar" aria-label="Bo loc hoa don">
        <label>
          Tim hoa don
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ma hoa don hoac khach hang"
          />
        </label>
        <label>
          Tu ngay
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label>
          Den ngay
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>
      </section>

      {locationState?.invoiceMessage ? <p className="state-message">{locationState.invoiceMessage}</p> : null}
      {invoicesQuery.isLoading ? <p className="state-message">Dang tai danh sach hoa don...</p> : null}
      {invoicesQuery.isError ? <p className="state-message error-message">{errorMessage}</p> : null}
      {invoicesQuery.isSuccess && invoices.length === 0 && !search.trim() && !dateFrom && !dateTo ? (
        <p className="state-message">Chua co hoa don ban hang.</p>
      ) : null}
      {invoicesQuery.isSuccess && invoices.length === 0 && (search.trim() || dateFrom || dateTo) ? (
        <p className="state-message">Khong co hoa don phu hop bo loc hien tai.</p>
      ) : null}
      {invoicesQuery.isSuccess && invoices.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ma hoa don</th>
                <th>Thoi gian</th>
                <th>Khach hang</th>
                <th>Tong tien</th>
                <th>Da thanh toan</th>
                <th>Trang thai</th>
                <th>Thao tac</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <Link className="table-link" to={`/sales/invoices/${invoice.id}`}>{invoice.invoice_code}</Link>
                  </td>
                  <td>{formatDateTime(invoice.invoice_datetime)}</td>
                  <td>{invoice.customer_snapshot_name}</td>
                  <td>{formatMoney(invoice.total_amount)}</td>
                  <td>{formatMoney(invoice.paid_amount)}</td>
                  <td>{invoiceStatusLabel(invoice.status)}</td>
                  <td>
                    <div className="row-actions">
                      <Link className="secondary-link" to={`/sales/invoices/${invoice.id}`}>
                        Xem
                      </Link>
                      {canCreate ? (
                        <Link className="primary-link" to={`/sales/invoices/${invoice.id}/edit`}>
                          Sua
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
