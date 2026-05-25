import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { isApiError } from "../../api/errors";
import type { HistoryEvent, HistoryEventType } from "../../api/types";
import { formatDateTime } from "../../domain/dates";
import { useCustomers } from "../customers/customerQueries";
import { HistoryDetailDrawer } from "./HistoryDetailDrawer";
import {
  historyEventTypeChip,
  historyEventTypeLabel,
  historyEventTypeOptions,
  historyStatusLabel,
  historyValueSummary,
  resolveHistoryOpenLink,
} from "./historyPresentation";
import { useProducts } from "../inventory/productQueries";
import { InventoryModuleShell } from "../inventory/InventoryModuleShell";
import { useHistory } from "./historyQueries";

const pageSizeOptions = [25, 50, 100] as const;

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function rangePreset(daysBack: number) {
  return {
    dateFrom: shiftDate(-daysBack),
    dateTo: todayDate(),
  };
}

export function HistoryListPage() {
  const location = useLocation();
  const historyContext = (location.state as {
    historyContext?: {
      dateFrom?: string;
      dateTo?: string;
      eventType?: HistoryEventType | "";
      search?: string;
      customerId?: number | null;
      productId?: number | null;
      page?: number;
      pageSize?: (typeof pageSizeOptions)[number];
    };
  } | null)?.historyContext;
  const [dateFrom, setDateFrom] = useState(historyContext?.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(historyContext?.dateTo ?? "");
  const [eventType, setEventType] = useState<HistoryEventType | "">(historyContext?.eventType ?? "");
  const [search, setSearch] = useState(historyContext?.search ?? "");
  const [customerId, setCustomerId] = useState<number | null>(historyContext?.customerId ?? null);
  const [productId, setProductId] = useState<number | null>(historyContext?.productId ?? null);
  const [page, setPage] = useState(historyContext?.page ?? 1);
  const [pageSize, setPageSize] = useState<(typeof pageSizeOptions)[number]>(historyContext?.pageSize ?? 25);
  const [selectedEvent, setSelectedEvent] = useState<HistoryEvent | null>(null);

  const customersQuery = useCustomers("", false, false);
  const productsQuery = useProducts("", false);
  const historyQuery = useHistory(search, dateFrom, dateTo, eventType, customerId, productId, page, pageSize);

  const payload = historyQuery.data;
  const rows = payload?.items ?? [];
  const total = payload?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasActiveFilters = Boolean(dateFrom || dateTo || eventType || search.trim() || customerId || productId);
  const errorMessage = isApiError(historyQuery.error)
    ? historyQuery.error.message
    : "Không thể tải lịch sử giao dịch.";

  const customerOptions = useMemo(
    () => [...(customersQuery.data ?? [])].sort((left, right) => left.customer_name.localeCompare(right.customer_name, "vi")),
    [customersQuery.data],
  );
  const productOptions = useMemo(
    () => [...(productsQuery.data ?? [])].sort((left, right) => left.product_name.localeCompare(right.product_name, "vi")),
    [productsQuery.data],
  );

  function applyRange(nextFrom: string, nextTo: string) {
    setDateFrom(nextFrom);
    setDateTo(nextTo);
    setPage(1);
    setSelectedEvent(null);
  }

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setEventType("");
    setSearch("");
    setCustomerId(null);
    setProductId(null);
    setPage(1);
    setSelectedEvent(null);
  }

  function selectEventType(nextType: HistoryEventType | "") {
    setEventType(nextType);
    setPage(1);
    setSelectedEvent(null);
  }

  function productColumnValue(event: HistoryEvent) {
    if (event.event_type === "SALES_INVOICE" || event.event_type === "RETURN_INVOICE") {
      return event.item_count ? `${event.item_count} mặt hàng` : "-";
    }
    return event.product_name || "-";
  }

  function customerColumnValue(event: HistoryEvent) {
    if (event.event_type === "STOCK_MOVEMENT" && event.source_type === "stock_adjustment") {
      return "-";
    }
    return event.customer_name || "-";
  }

  function valueSummaryLines(event: HistoryEvent) {
    const lines = historyValueSummary(event);
    if (event.event_type === "SALES_INVOICE" || event.event_type === "RETURN_INVOICE") {
      return lines;
    }
    return lines;
  }

  const detailReturnState = {
    returnTo: "/history",
    returnLabel: "Quay lại lịch sử",
    returnState: {
      historyContext: {
        dateFrom,
        dateTo,
        eventType,
        search,
        customerId,
        productId,
        page,
        pageSize,
      },
    },
  };

  return (
    <InventoryModuleShell
      title="Lịch sử"
      description="Theo dõi toàn bộ lịch sử bán hàng, trả hàng, công nợ, tồn kho và đặt hàng từ một danh sách hợp nhất."
      contentClassName="history-layout"
      compactHero
      hideDescription
    >
      <aside className="history-filter-panel" aria-label="Bộ lọc lịch sử">
        <section className="history-filter-card">
          <div className="history-filter-card__header">
            <h3>Bộ lọc</h3>
            <span>{eventType ? historyEventTypeChip(eventType) : "Toàn bộ"}</span>
          </div>

          <div className="history-preset-list" role="group" aria-label="Mốc thời gian nhanh">
            <button className="inventory-ghost-button" type="button" onClick={() => applyRange(todayDate(), todayDate())}>
              Hôm nay
            </button>
            <button className="inventory-ghost-button" type="button" onClick={() => applyRange(rangePreset(6).dateFrom, rangePreset(6).dateTo)}>
              7 ngày
            </button>
            <button className="inventory-ghost-button" type="button" onClick={() => applyRange(rangePreset(29).dateFrom, rangePreset(29).dateTo)}>
              30 ngày
            </button>
          </div>

          <label className="history-filter-field">
            Từ ngày
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
                setSelectedEvent(null);
              }}
            />
          </label>
          <label className="history-filter-field">
            Đến ngày
            <input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
                setSelectedEvent(null);
              }}
            />
          </label>

          <label className="history-filter-field">
            Khách hàng
            <select
              value={customerId ?? ""}
              onChange={(event) => {
                setCustomerId(event.target.value ? Number(event.target.value) : null);
                setPage(1);
                setSelectedEvent(null);
              }}
            >
              <option value="">Tất cả khách hàng</option>
              {customerOptions.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customer_name}
                </option>
              ))}
            </select>
          </label>

          <label className="history-filter-field">
            Sản phẩm
            <select
              value={productId ?? ""}
              onChange={(event) => {
                setProductId(event.target.value ? Number(event.target.value) : null);
                setPage(1);
                setSelectedEvent(null);
              }}
            >
              <option value="">Tất cả sản phẩm</option>
              {productOptions.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.product_name}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="history-filter-card">
          <div className="history-filter-card__header">
            <h3>Loại giao dịch</h3>
            <span>{historyEventTypeOptions.length - 1} loại</span>
          </div>

          <div className="history-chip-grid" role="group" aria-label="Lọc theo loại giao dịch">
            {historyEventTypeOptions.map((option) => (
              <button
                key={option.value || "ALL"}
                type="button"
                className={eventType === option.value ? "history-chip active" : "history-chip"}
                onClick={() => selectEventType(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="history-filter-card">
          <div className="history-filter-card__header">
            <h3>Tìm kiếm</h3>
            <span>Mã / từ khóa</span>
          </div>
          <label className="history-filter-field">
            Mã chứng từ hoặc từ khóa
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
                setSelectedEvent(null);
              }}
              placeholder="Ví dụ: HD20260520 hoặc tên khách hàng"
            />
          </label>

          <label className="history-filter-field">
            Số dòng mỗi trang
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value) as (typeof pageSizeOptions)[number]);
                setPage(1);
                setSelectedEvent(null);
              }}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size} dòng
                </option>
              ))}
            </select>
          </label>

          <button className="inventory-ghost-button history-reset-button" type="button" onClick={clearFilters}>
            Xóa bộ lọc
          </button>
        </section>
      </aside>

      <section className="history-main-panel">
        <div className="inventory-selection-bar history-selection-bar">
          <span>{total} giao dịch tìm thấy</span>
          <span>
            Trang {payload?.page ?? page}/{totalPages}
          </span>
        </div>

        {historyQuery.isLoading ? <p className="state-message">Đang tải lịch sử giao dịch...</p> : null}
        {historyQuery.isError ? <p className="state-message error-message">{errorMessage}</p> : null}
        {historyQuery.isSuccess && rows.length === 0 && !hasActiveFilters ? (
          <p className="state-message">Chưa có lịch sử giao dịch.</p>
        ) : null}
        {historyQuery.isSuccess && rows.length === 0 && hasActiveFilters ? (
          <p className="state-message">Không có giao dịch phù hợp bộ lọc hiện tại.</p>
        ) : null}

        {historyQuery.isSuccess && rows.length > 0 ? (
          <>
            <div className={selectedEvent ? "history-workspace history-workspace--with-drawer" : "history-workspace"}>
              <div className="inventory-table-wrap history-table-wrap">
                <table className="data-table inventory-data-table history-data-table">
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Loại giao dịch</th>
                      <th>Mã chứng từ</th>
                      <th>Khách hàng</th>
                      <th>Sản phẩm</th>
                      <th>Giá trị / Số lượng</th>
                      <th>Trạng thái</th>
                      <th>Mở</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((event) => {
                      const openLink = resolveHistoryOpenLink(event);
                      const valueLines = valueSummaryLines(event);
                      const isSelected =
                        selectedEvent?.event_type === event.event_type
                        && selectedEvent.event_id === event.event_id
                        && selectedEvent.source_type === event.source_type;
                      return (
                        <tr
                          key={`${event.event_type}-${event.event_id}-${event.source_type ?? "none"}-${event.product_id ?? "none"}`}
                          className={isSelected ? "history-row-selected" : undefined}
                          data-selected={isSelected ? "true" : "false"}
                          onClick={() => setSelectedEvent(event)}
                        >
                          <td>{formatDateTime(event.event_datetime)}</td>
                          <td>
                            <div className="history-cell-stack">
                              <strong>{historyEventTypeLabel(event.event_type)}</strong>
                              {event.note ? <span>{event.note}</span> : null}
                            </div>
                          </td>
                          <td>{event.code || "-"}</td>
                          <td>{customerColumnValue(event)}</td>
                          <td>{productColumnValue(event)}</td>
                          <td>
                            <div className="history-cell-stack">
                              {valueLines.map((line) => (
                                <span key={line}>{line}</span>
                              ))}
                            </div>
                          </td>
                          <td>{historyStatusLabel(event)}</td>
                          <td>
                            {openLink ? (
                              <Link
                                className="inventory-ghost-button history-open-link"
                                to={openLink}
                                state={detailReturnState}
                                onClick={(rowEvent) => rowEvent.stopPropagation()}
                              >
                                Mở chi tiết
                              </Link>
                            ) : (
                              <span className="history-open-placeholder">Chưa có</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {selectedEvent ? (
                <HistoryDetailDrawer
                  event={selectedEvent}
                  onClose={() => setSelectedEvent(null)}
                  returnState={detailReturnState}
                />
              ) : null}
            </div>

            <div className="history-pagination">
              <button
                className="inventory-ghost-button"
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  setPage((current) => Math.max(1, current - 1));
                  setSelectedEvent(null);
                }}
              >
                Trang trước
              </button>
              <span>
                Hiển thị {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} / {total}
              </span>
              <button
                className="inventory-ghost-button"
                type="button"
                disabled={page >= totalPages}
                onClick={() => {
                  setPage((current) => Math.min(totalPages, current + 1));
                  setSelectedEvent(null);
                }}
              >
                Trang sau
              </button>
            </div>
          </>
        ) : null}
      </section>
    </InventoryModuleShell>
  );
}
