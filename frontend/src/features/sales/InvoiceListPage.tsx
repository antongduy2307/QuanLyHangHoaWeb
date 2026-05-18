import { Link } from "react-router-dom";

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
  const invoicesQuery = useInvoices();
  const errorMessage = isApiError(invoicesQuery.error) ? invoicesQuery.error.message : "Khong the tai danh sach hoa don.";
  const canCreate = user ? writeRoles.some((role) => role === user.role) : false;

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

      {invoicesQuery.isLoading ? <p className="state-message">Dang tai danh sach hoa don...</p> : null}
      {invoicesQuery.isError ? <p className="state-message error-message">{errorMessage}</p> : null}
      {invoicesQuery.isSuccess && invoicesQuery.data.length === 0 ? (
        <p className="state-message">Chua co hoa don ban hang.</p>
      ) : null}
      {invoicesQuery.isSuccess && invoicesQuery.data.length > 0 ? (
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
              </tr>
            </thead>
            <tbody>
              {invoicesQuery.data.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <Link to={`/sales/invoices/${invoice.id}`}>{invoice.invoice_code}</Link>
                  </td>
                  <td>{formatDateTime(invoice.invoice_datetime)}</td>
                  <td>{invoice.customer_snapshot_name}</td>
                  <td>{formatMoney(invoice.total_amount)}</td>
                  <td>{formatMoney(invoice.paid_amount)}</td>
                  <td>{invoiceStatusLabel(invoice.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
