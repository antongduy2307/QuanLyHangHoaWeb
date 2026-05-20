import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { isApiError } from "../../api/errors";
import { useAuth } from "../../auth/useAuth";
import { PageHeader } from "../../components/PageHeader";
import { formatDateTime } from "../../domain/dates";
import { returnHandlingModeLabel } from "../../domain/documents";
import { formatMoney } from "../../domain/money";
import { useReturns } from "./returnQueries";

const writeRoles = ["owner", "admin"] as const;

export function ReturnListPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const location = useLocation();
  const locationState = location.state as { returnMessage?: string } | null;
  const returnsQuery = useReturns(search, dateFrom, dateTo);
  const errorMessage = isApiError(returnsQuery.error) ? returnsQuery.error.message : "Khong the tai danh sach phieu tra.";
  const canCreate = user ? writeRoles.some((role) => role === user.role) : false;
  const returns = returnsQuery.data ?? [];
  const hasActiveFilters = Boolean(search.trim() || dateFrom || dateTo);

  return (
    <>
      <div className="page-title-row">
        <PageHeader title="Tra hang" description="Danh sach phieu tra hang da ghi nhan." />
        {canCreate ? (
          <Link className="primary-link" to="/returns/new">
            Tao phieu tra
          </Link>
        ) : null}
      </div>

      <section className="toolbar" aria-label="Bo loc phieu tra">
        <label>
          Tim phieu tra
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ma phieu tra, khach hang hoac hoa don goc"
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

      {locationState?.returnMessage ? <p className="state-message">{locationState.returnMessage}</p> : null}
      {returnsQuery.isLoading ? <p className="state-message">Dang tai danh sach phieu tra...</p> : null}
      {returnsQuery.isError ? <p className="state-message error-message">{errorMessage}</p> : null}
      {returnsQuery.isSuccess && returns.length === 0 ? (
        <p className="state-message">{hasActiveFilters ? "Khong co phieu tra phu hop bo loc hien tai." : "Chua co phieu tra hang."}</p>
      ) : null}
      {returnsQuery.isSuccess && returns.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ma phieu tra</th>
                <th>Thoi gian</th>
                <th>Khach hang</th>
                <th>Tong tien</th>
                <th>Xu ly</th>
                <th>Hoa don goc</th>
                <th>Thao tac</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((returnInvoice) => (
                <tr key={returnInvoice.id}>
                  <td>
                    <Link className="table-link" to={`/returns/${returnInvoice.id}`}>
                      {returnInvoice.return_code}
                    </Link>
                  </td>
                  <td>{formatDateTime(returnInvoice.return_datetime)}</td>
                  <td>{returnInvoice.customer_snapshot_name}</td>
                  <td>{formatMoney(returnInvoice.total_amount)}</td>
                  <td>{returnHandlingModeLabel(returnInvoice.handling_mode)}</td>
                  <td>{returnInvoice.source_invoice_id ? `#${returnInvoice.source_invoice_id}` : "-"}</td>
                  <td>
                    <div className="row-actions">
                      <Link className="secondary-link" to={`/returns/${returnInvoice.id}`}>
                        Xem
                      </Link>
                      {canCreate ? (
                        <Link className="primary-link" to={`/returns/${returnInvoice.id}/edit`}>
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
