import { useState } from "react";
import { Link } from "react-router-dom";

import { isApiError } from "../../api/errors";
import { useAuth } from "../../auth/useAuth";
import { PageHeader } from "../../components/PageHeader";
import { formatMoney } from "../../domain/money";
import { useCustomers } from "./customerQueries";

const writeRoles = ["owner", "admin"] as const;

function canWriteCustomers(role: string) {
  return writeRoles.some((writeRole) => writeRole === role);
}

export function CustomerListPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [onlyPositiveDebt, setOnlyPositiveDebt] = useState(false);
  const customersQuery = useCustomers(search, onlyPositiveDebt);
  const canCreate = user ? canWriteCustomers(user.role) : false;
  const errorMessage = isApiError(customersQuery.error)
    ? customersQuery.error.message
    : "Khong the tai danh sach khach hang.";

  return (
    <>
      <div className="page-title-row">
        <PageHeader title="Khach hang" description="Quan ly ho so khach hang, so du cong no va tong mua." />
        {canCreate ? (
          <Link className="primary-link" to="/customers/new">
            Tạo khách hàng
          </Link>
        ) : null}
      </div>

      <section className="toolbar" aria-label="Bo loc khach hang">
        <label>
          Tim kiem
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ten, dien thoai" />
        </label>
        <label className="inline-choice filter-choice">
          <input
            type="checkbox"
            checked={onlyPositiveDebt}
            onChange={(event) => setOnlyPositiveDebt(event.target.checked)}
          />
          Chi hien khach dang no
        </label>
      </section>

      {customersQuery.isLoading ? <p className="state-message">Dang tai danh sach khach hang...</p> : null}
      {customersQuery.isError ? <p className="state-message error-message">{errorMessage}</p> : null}
      {customersQuery.isSuccess && customersQuery.data.length === 0 ? (
        <p className="state-message">Chua co khach hang phu hop.</p>
      ) : null}
      {customersQuery.isSuccess && customersQuery.data.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ten khach hang</th>
                <th>Dien thoai</th>
                <th>Dia chi</th>
                <th>So du</th>
                <th>Tong mua</th>
                <th>Trang thai</th>
              </tr>
            </thead>
            <tbody>
              {customersQuery.data.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <Link className="table-link" to={`/customers/${customer.id}`}>
                      {customer.customer_name}
                    </Link>
                  </td>
                  <td>{customer.phone || "-"}</td>
                  <td>{customer.address || "-"}</td>
                  <td>{formatMoney(customer.current_balance)}</td>
                  <td>{formatMoney(customer.total_sales)}</td>
                  <td>{customer.is_active ? "Dang dung" : "Ngung dung"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
