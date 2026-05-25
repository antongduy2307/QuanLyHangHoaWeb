import { Fragment, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { isApiError } from "../../api/errors";
import type { Customer } from "../../api/types";
import { useAuth } from "../../auth/useAuth";
import { formatMoney } from "../../domain/money";
import { InventoryModuleShell } from "../inventory/InventoryModuleShell";
import { CustomerFormDialog } from "./CustomerFormDialog";
import { CustomerInlineDetailPanel } from "./CustomerInlineDetailPanel";
import { useCustomers } from "./customerQueries";

const writeRoles = ["owner", "admin"] as const;
const customerSortOptions = [
  { label: "Tên A-Z", value: "name_asc" },
  { label: "Tên Z-A", value: "name_desc" },
  { label: "Công nợ tăng dần", value: "balance_asc" },
  { label: "Công nợ giảm dần", value: "balance_desc" },
  { label: "Tổng mua tăng dần", value: "sales_asc" },
  { label: "Tổng mua giảm dần", value: "sales_desc" },
] as const;

type CustomerSortOption = (typeof customerSortOptions)[number]["value"];

function canWriteCustomers(role: string) {
  return writeRoles.some((writeRole) => writeRole === role);
}

function compareCustomers(left: Customer, right: Customer, sortOption: CustomerSortOption) {
  switch (sortOption) {
    case "name_desc":
      return right.customer_name.localeCompare(left.customer_name, "vi");
    case "balance_asc":
      return Number(left.current_balance) - Number(right.current_balance);
    case "balance_desc":
      return Number(right.current_balance) - Number(left.current_balance);
    case "sales_asc":
      return Number(left.total_sales) - Number(right.total_sales);
    case "sales_desc":
      return Number(right.total_sales) - Number(left.total_sales);
    case "name_asc":
    default:
      return left.customer_name.localeCompare(right.customer_name, "vi");
  }
}

export function CustomerListPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [sortOption, setSortOption] = useState<CustomerSortOption>("name_asc");
  const [onlyPositiveDebt, setOnlyPositiveDebt] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const location = useLocation();
  const locationState = location.state as {
    customerDeleteMessage?: string;
    focusCustomerId?: number;
    openInlineTab?: "general" | "history" | "debt";
  } | null;
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(locationState?.focusCustomerId ?? null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const customersQuery = useCustomers(search, onlyPositiveDebt, includeInactive);
  const canCreate = user ? canWriteCustomers(user.role) : false;
  const errorMessage = isApiError(customersQuery.error)
    ? customersQuery.error.message
    : "Không thể tải danh sách khách hàng.";
  const customers = customersQuery.data ?? [];
  const sortedCustomers = [...customers].sort((left, right) => compareCustomers(left, right, sortOption));
  const totalDebt = sortedCustomers.reduce((sum, customer) => sum + Number(customer.current_balance), 0);
  const totalSales = sortedCustomers.reduce((sum, customer) => sum + Number(customer.total_sales), 0);
  const visibleSelectedCustomerId = sortedCustomers.some((customer) => customer.id === selectedCustomerId)
    ? selectedCustomerId
    : null;

  return (
    <InventoryModuleShell
      title="Khách hàng"
      description="Quản lý hồ sơ khách hàng, công nợ hiện tại và tổng mua."
      contentClassName="customer-list-layout"
      compactHero
      hideDescription
    >
        <aside className="customer-filter-panel" aria-label="Bộ lọc khách hàng">
          <section className="customer-filter-card">
            <div className="customer-filter-card__header">
              <h3>Điều khiển</h3>
              <span>Customer</span>
            </div>
            {canCreate ? (
              <button
                className="inventory-solid-button customer-create-button"
                type="button"
                onClick={() => setShowCreateModal(true)}
              >
                Tạo khách
              </button>
            ) : null}
          </section>

          <section className="customer-filter-card">
            <div className="customer-filter-card__header">
              <h3>Sắp xếp</h3>
              <span>{customerSortOptions.length} lựa chọn</span>
            </div>
            <label className="customer-filter-field">
              Thứ tự hiển thị
              <select value={sortOption} onChange={(event) => setSortOption(event.target.value as CustomerSortOption)}>
                {customerSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="customer-filter-card">
            <div className="customer-filter-card__header">
              <h3>Bộ lọc</h3>
              <span>Công nợ</span>
            </div>
            <label className="customer-filter-option">
              <input
                type="checkbox"
                checked={onlyPositiveDebt}
                onChange={(event) => setOnlyPositiveDebt(event.target.checked)}
              />
              <span>Chỉ hiện khách đang nợ</span>
            </label>
            <label className="customer-filter-option">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
              />
              <span>Hiện khách ngừng dùng</span>
            </label>
          </section>
        </aside>

        <section className="customer-main-panel">
          <div className="inventory-toolbar customer-toolbar">
            <div className="inventory-toolbar__search">
              <label htmlFor="customer-search">Tìm kiếm</label>
              <input
                id="customer-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo tên khách hàng"
              />
            </div>
          </div>

          {locationState?.customerDeleteMessage ? <p className="state-message">{locationState.customerDeleteMessage}</p> : null}
          {customersQuery.isLoading ? <p className="state-message">Đang tải danh sách khách hàng...</p> : null}
          {customersQuery.isError ? <p className="state-message error-message">{errorMessage}</p> : null}
          {customersQuery.isSuccess && sortedCustomers.length === 0 ? (
            <p className="state-message">Chưa có khách hàng phù hợp.</p>
          ) : null}
          {customersQuery.isSuccess && sortedCustomers.length > 0 ? (
            <>
              <div className="inventory-selection-bar customer-selection-bar">
                <span>
                  {visibleSelectedCustomerId === null
                    ? `${sortedCustomers.length} khách hàng đang hiển thị`
                    : `Đang chọn #${visibleSelectedCustomerId}`}
                </span>
                <span>Tổng hợp từ kết quả hiện tại</span>
              </div>
              <div className="inventory-table-wrap customer-table-wrap">
                <table className="data-table inventory-data-table customer-data-table">
                  <thead>
                    <tr>
                      <th>Tên khách</th>
                      <th>Điện thoại</th>
                      <th>Công nợ</th>
                      <th>Tổng mua</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="customer-summary-row" data-summary-row="true">
                      <td>Tổng cộng</td>
                      <td>-</td>
                      <td>{formatMoney(totalDebt.toFixed(2))}</td>
                      <td>{formatMoney(totalSales.toFixed(2))}</td>
                    </tr>
                    {sortedCustomers.map((customer) => (
                      <Fragment key={customer.id}>
                        <tr
                          className={[
                            "inventory-row",
                            "customer-row",
                            visibleSelectedCustomerId === customer.id ? "selected" : "",
                            customer.is_active ? "" : "customer-row--inactive",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          data-selected={visibleSelectedCustomerId === customer.id ? "true" : "false"}
                          data-customer-id={customer.id}
                          onClick={() =>
                            setSelectedCustomerId((current) => (current === customer.id ? null : customer.id))
                          }
                        >
                          <td>
                            <Link className="table-link" to={`/customers/${customer.id}`}>
                              {customer.customer_name}
                            </Link>
                            {!customer.is_active ? <div className="customer-status-badge">Ngừng dùng</div> : null}
                          </td>
                          <td>{customer.phone || "-"}</td>
                          <td className={Number(customer.current_balance) > 0 ? "customer-money customer-money--debt" : undefined}>
                            {formatMoney(customer.current_balance)}
                          </td>
                          <td>{formatMoney(customer.total_sales)}</td>
                        </tr>
                        {visibleSelectedCustomerId === customer.id ? (
                          <tr className="customer-detail-row" data-customer-detail-id={customer.id}>
                            <td colSpan={4}>
                              <CustomerInlineDetailPanel
                                customerId={customer.id}
                                onEditRequest={setEditingCustomer}
                                initialActiveTab={locationState?.focusCustomerId === customer.id ? locationState.openInlineTab : undefined}
                              />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      {showCreateModal ? <CustomerFormDialog customer={null} onClose={() => setShowCreateModal(false)} /> : null}
      {editingCustomer ? <CustomerFormDialog customer={editingCustomer} onClose={() => setEditingCustomer(null)} /> : null}
    </InventoryModuleShell>
  );
}
