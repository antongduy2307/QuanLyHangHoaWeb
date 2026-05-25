import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../auth/useAuth";
import type { Order, OrderQuantitySummaryRow, Product } from "../../api/types";
import { InventoryModuleShell } from "../inventory/InventoryModuleShell";
import { useProducts } from "../inventory/productQueries";
import { defaultPriceForUnit } from "../sales/invoiceSchemas";
import { useDeleteOrder, useMarkOrderPrepared, useOrders, useOrderQuantitySummary } from "./orderQueries";

type OrderTab = "customers" | "summary";
type SummarySort = "quantity" | "name";

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatQuantity(value: string | null) {
  if (!value) {
    return "-";
  }
  return Number(value).toString();
}

function statusLabel(order: Order) {
  return order.status === "PREPARED" ? "Đã hoàn thành" : "Đang mở";
}

export function OrderListPage() {
  const { user } = useAuth();
  const ordersQuery = useOrders();
  const summaryQuery = useOrderQuantitySummary();
  const productsQuery = useProducts("");
  const [activeTab, setActiveTab] = useState<OrderTab>("customers");
  const [summarySearch, setSummarySearch] = useState("");
  const [summarySort, setSummarySort] = useState<SummarySort>("quantity");
  const canMutate = user?.role === "owner" || user?.role === "admin";

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const summaryRows = useMemo(() => summaryQuery.data ?? [], [summaryQuery.data]);
  const filteredSummaryRows = useMemo(() => {
    const query = summarySearch.trim().toLowerCase();
    const filtered = summaryRows.filter((row) => !query || row.product_name.toLowerCase().includes(query));
    return [...filtered].sort((left, right) => {
      if (summarySort === "name") {
        return left.product_name.localeCompare(right.product_name);
      }
      return Number(right.quantity) - Number(left.quantity);
    });
  }, [summaryRows, summarySearch, summarySort]);

  if (ordersQuery.isLoading || summaryQuery.isLoading || productsQuery.isLoading) {
    return (
      <InventoryModuleShell title="Đặt hàng" description="" contentClassName="inventory-detail-layout" compactHero>
        <p className="state-message">Đang tải đơn đặt hàng...</p>
      </InventoryModuleShell>
    );
  }

  if (ordersQuery.isError || summaryQuery.isError || productsQuery.isError) {
    return (
      <InventoryModuleShell title="Đặt hàng" description="" contentClassName="inventory-detail-layout" compactHero>
        <p className="state-message error-message">Không thể tải đơn đặt hàng.</p>
      </InventoryModuleShell>
    );
  }

  return (
    <InventoryModuleShell
      title="Đặt hàng"
      description="Theo dõi đơn đang mở và tổng số lượng hàng cần làm theo khách hàng, đơn vị và tồn kho hiện tại."
      contentClassName="inventory-detail-layout"
      compactHero
    >
      <div className="inventory-detail-card order-page-card">
        <div className="inventory-mode-tabs" role="tablist" aria-label="Tabs đặt hàng">
          <button
            type="button"
            className={activeTab === "customers" ? "inventory-mode-tab active" : "inventory-mode-tab"}
            onClick={() => setActiveTab("customers")}
          >
            Khách hàng
          </button>
          <button
            type="button"
            className={activeTab === "summary" ? "inventory-mode-tab active" : "inventory-mode-tab"}
            onClick={() => setActiveTab("summary")}
          >
            Tổng số lượng hàng cần làm
          </button>
        </div>

        {activeTab === "customers" ? (
          <div className="order-customer-tab">
            <table className="inventory-data-table order-data-table">
              <thead>
                <tr>
                  <th>Ngày đặt</th>
                  <th>Tên khách hàng</th>
                  <th>Ngày cần giao</th>
                  <th>Ghi chú</th>
                  <th>Trạng thái</th>
                  {canMutate ? <th>Thao tác</th> : null}
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={canMutate ? 6 : 5}>
                      <div className="sales-empty-lines">
                        <p>Chưa có đơn đặt hàng đang mở.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <OrderRow key={order.id} order={order} canMutate={canMutate} products={products} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="order-summary-tab">
            <div className="order-summary-controls">
              <label className="inventory-toolbar__search">
                <span>Tìm theo tên hàng</span>
                <input
                  placeholder="Tìm theo tên hàng"
                  value={summarySearch}
                  onChange={(event) => setSummarySearch(event.target.value)}
                />
              </label>
              <label className="order-sort-select">
                <span>Sắp xếp</span>
                <select value={summarySort} onChange={(event) => setSummarySort(event.target.value as SummarySort)}>
                  <option value="quantity">Số lượng giảm dần</option>
                  <option value="name">Tên hàng</option>
                </select>
              </label>
            </div>

            <table className="inventory-data-table order-data-table">
              <thead>
                <tr>
                  <th>Mã hàng</th>
                  <th>Tên hàng</th>
                  <th>Đơn vị</th>
                  <th>Tổng số lượng cần làm</th>
                  <th>Tồn kho hiện tại</th>
                </tr>
              </thead>
              <tbody>
                {filteredSummaryRows.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="sales-empty-lines">
                        <p>Không có dòng tổng hợp phù hợp.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSummaryRows.map((row) => <OrderSummaryRow key={`${row.product_id}-${row.unit_type}`} row={row} />)
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </InventoryModuleShell>
  );
}

function OrderRow({ order, canMutate, products }: { order: Order; canMutate: boolean; products: Product[] }) {
  const markPrepared = useMarkOrderPrepared(order.id);
  const deleteOrder = useDeleteOrder(order.id);

  async function handlePreparedToggle() {
    await markPrepared.mutateAsync(order.status !== "PREPARED");
  }

  async function handleDelete() {
    if (!window.confirm("Bạn có chắc muốn xóa đơn đặt hàng này không?")) {
      return;
    }
    await deleteOrder.mutateAsync();
  }

  return (
    <tr className="inventory-row">
      <td>{formatDateTime(order.order_datetime)}</td>
      <td>{order.customer_name_snapshot}</td>
      <td>{formatDateTime(order.required_delivery_datetime)}</td>
      <td>{order.note || "-"}</td>
      <td>{statusLabel(order)}</td>
      {canMutate ? (
        <td>
          <div className="order-row-actions">
            <button type="button" className="inventory-ghost-button" onClick={() => void handlePreparedToggle()}>
              {order.status === "PREPARED" ? "Bỏ hoàn thành" : "Đã hoàn thành"}
            </button>
            <Link
              className="inventory-ghost-button"
              to="/sales/invoices/new"
              state={{
                sourceOrderDraft: {
                  sourceOrderId: order.id,
                  customerId: order.customer_id ? String(order.customer_id) : "",
                  customerSnapshotName: order.customer_name_snapshot,
                  note: order.note ?? "",
                  items: order.items.map((item) => {
                    const product = products.find((candidate) => candidate.id === item.product_id);
                    return {
                      productId: String(item.product_id),
                      unitType: item.unit_type,
                      quantity: item.quantity,
                      unitPrice: product ? defaultPriceForUnit(product, item.unit_type) : "0",
                    };
                  }),
                },
              }}
            >
              Bán hàng
            </Link>
            <button type="button" className="inventory-ghost-button inventory-ghost-button--danger" onClick={() => void handleDelete()}>
              Xóa
            </button>
          </div>
        </td>
      ) : null}
    </tr>
  );
}

function OrderSummaryRow({ row }: { row: OrderQuantitySummaryRow }) {
  return (
    <tr className="inventory-row">
      <td>{`#${row.product_id}`}</td>
      <td>{row.product_name}</td>
      <td>{row.unit_type}</td>
      <td>{formatQuantity(row.quantity)}</td>
      <td>{formatQuantity(row.stock_available)}</td>
    </tr>
  );
}
