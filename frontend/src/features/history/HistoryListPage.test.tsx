import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HistoryEvent, HistoryListResponse } from "../../api/types";
import { setRefreshToken } from "../../auth/tokenStore";
import type { UserRole } from "../../domain/roles";
import { renderRoute } from "../../tests/testUtils";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authUser(role: UserRole = "owner") {
  return {
    id: 1,
    username: `${role}_history_user`,
    display_name: `${role} history user`,
    role,
    is_active: true,
  };
}

function historyRows(): HistoryEvent[] {
  return [
    {
      event_type: "ORDER",
      event_id: 61,
      event_datetime: "2026-05-20T14:00:00Z",
      display_order: 0,
      code: "DH20260520-001",
      customer_id: 21,
      customer_name: "Tran History",
      product_id: 11,
      product_name: "Bot History B",
      amount: null,
      paid_amount: null,
      item_count: 1,
      quantity: "2.000",
      unit_type: "BAO",
      status: "CONVERTED",
      source_type: "order",
      source_id: 61,
      note: "Converted order",
      open_target: { target_type: "order", target_id: 61, route: "/orders/61" },
    },
    {
      event_type: "STOCK_MOVEMENT",
      event_id: 41,
      event_datetime: "2026-05-20T13:00:00Z",
      display_order: 0,
      code: null,
      customer_id: null,
      customer_name: null,
      product_id: 10,
      product_name: "Gao History A",
      amount: null,
      paid_amount: null,
      item_count: null,
      quantity: "-1.000",
      unit_type: "BAO",
      status: "STOCK_SET",
      source_type: "stock_adjustment",
      source_id: 41,
      note: "Counted stock",
      open_target: { target_type: "product", target_id: 10, route: "/inventory/products/10" },
    },
    {
      event_type: "BALANCE_ADJUSTMENT",
      event_id: 31,
      event_datetime: "2026-05-20T12:00:00Z",
      display_order: 0,
      code: null,
      customer_id: 21,
      customer_name: "Tran History",
      product_id: null,
      product_name: null,
      amount: "45.00",
      paid_amount: null,
      item_count: null,
      quantity: null,
      unit_type: null,
      status: "BALANCE_ADJUSTMENT",
      source_type: "balance_adjustment",
      source_id: 99,
      note: "Manual fix",
      open_target: { target_type: "customer", target_id: 21, route: "/customers/21" },
    },
    {
      event_type: "DEBT_PAYMENT",
      event_id: 22,
      event_datetime: "2026-05-20T11:00:00Z",
      display_order: 30,
      code: null,
      customer_id: 21,
      customer_name: "Tran History",
      product_id: null,
      product_name: null,
      amount: "15.00",
      paid_amount: null,
      item_count: null,
      quantity: null,
      unit_type: null,
      status: null,
      source_type: "debt_payment",
      source_id: 22,
      note: "Standalone payment",
      open_target: { target_type: "customer", target_id: 21, route: "/customers/21" },
    },
    {
      event_type: "RETURN_INVOICE",
      event_id: 13,
      event_datetime: "2026-05-20T10:00:00Z",
      display_order: 0,
      code: "TR20260520-001",
      customer_id: 21,
      customer_name: "Tran History",
      product_id: null,
      product_name: null,
      amount: "100.00",
      paid_amount: null,
      item_count: 1,
      quantity: null,
      unit_type: null,
      status: "STORE_CREDIT",
      source_type: "return",
      source_id: 13,
      note: "Return note",
      open_target: { target_type: "return", target_id: 13, route: "/returns/13" },
    },
    {
      event_type: "SALES_INVOICE",
      event_id: 12,
      event_datetime: "2026-05-20T09:00:00Z",
      display_order: 0,
      code: "HD20260520-001",
      customer_id: 21,
      customer_name: "Tran History",
      product_id: null,
      product_name: null,
      amount: "200.00",
      paid_amount: "30.00",
      item_count: 2,
      quantity: null,
      unit_type: null,
      status: "COMPLETED",
      source_type: "invoice",
      source_id: 12,
      note: "Invoice note",
      open_target: { target_type: "invoice", target_id: 12, route: "/sales/invoices/12" },
    },
  ];
}

function paginatedRows(count: number): HistoryEvent[] {
  return Array.from({ length: count }, (_, index) => ({
    ...historyRows()[0],
    event_id: 1000 + index,
    code: `DH20260520-${String(index + 1).padStart(3, "0")}`,
    source_id: 1000 + index,
  }));
}

function historyPage(rows: HistoryEvent[], page = 1, pageSize = 25): HistoryListResponse {
  const startIndex = (page - 1) * pageSize;
  return {
    page,
    page_size: pageSize,
    total: rows.length,
    items: rows.slice(startIndex, startIndex + pageSize),
  };
}

function mockHistorySession(role: UserRole, rows: HistoryEvent[] = historyRows()) {
  setRefreshToken("stored-refresh");
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const pathname = url.pathname;

    if (pathname.endsWith("/auth/refresh")) {
      return Promise.resolve(jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }));
    }
    if (pathname.endsWith("/auth/me")) {
      return Promise.resolve(jsonResponse(authUser(role)));
    }
    if (pathname.endsWith("/history")) {
      const page = Number(url.searchParams.get("page") ?? "1");
      const pageSize = Number(url.searchParams.get("page_size") ?? "25");
      return Promise.resolve(jsonResponse(historyPage(rows, page, pageSize)));
    }
    if (pathname.endsWith("/customers")) {
      return Promise.resolve(jsonResponse([{ id: 21, customer_name: "Tran History", phone: "0909000000", address: "Ha Noi", note: "Khach quen", current_balance: "60.00", total_sales: "100.00", is_walk_in: false, is_active: true, created_at: "2026-05-20T09:00:00Z", updated_at: "2026-05-20T09:00:00Z" }]));
    }
    if (pathname.endsWith("/inventory/products")) {
      return Promise.resolve(jsonResponse([
        { id: 10, product_code_base: "HISTORY-A", product_name: "Gao History A", unit_mode: "BAO_KG", is_active: true, created_at: "2026-05-20T09:00:00Z", updated_at: "2026-05-20T09:00:00Z", prices: [], balance: null },
        { id: 11, product_code_base: "HISTORY-B", product_name: "Bot History B", unit_mode: "BAO_KG", is_active: true, created_at: "2026-05-20T09:00:00Z", updated_at: "2026-05-20T09:00:00Z", prices: [], balance: null },
      ]));
    }
    if (pathname.endsWith("/sales/invoices/12")) {
      return Promise.resolve(
        jsonResponse({
          id: 12,
          invoice_code: "HD20260520-001",
          customer_id: 21,
          customer_snapshot_name: "Tran History",
          invoice_datetime: "2026-05-20T09:00:00Z",
          total_amount: "200.00",
          paid_amount: "30.00",
          payment_method: "CASH",
          status: "COMPLETED",
          note: "Invoice note",
          created_at: "2026-05-20T09:00:00Z",
          updated_at: "2026-05-20T09:00:00Z",
          items: [
            { id: 1201, product_id: 10, unit_type: "BAO", quantity: "1.000", unit_price: "100.00", line_total: "100.00", product_code_snapshot: "HISTORY-A", product_name_snapshot: "Gao History A" },
            { id: 1202, product_id: 11, unit_type: "BAO", quantity: "2.000", unit_price: "50.00", line_total: "100.00", product_code_snapshot: "HISTORY-B", product_name_snapshot: "Bot History B" },
          ],
        }),
      );
    }
    if (pathname.endsWith("/returns/13")) {
      return Promise.resolve(
        jsonResponse({
          id: 13,
          return_code: "TR20260520-001",
          source_invoice_id: 12,
          customer_id: 21,
          customer_snapshot_name: "Tran History",
          is_quick_return: false,
          return_datetime: "2026-05-20T10:00:00Z",
          total_amount: "100.00",
          handling_mode: "STORE_CREDIT",
          note: "Return note",
          created_at: "2026-05-20T10:00:00Z",
          updated_at: "2026-05-20T10:00:00Z",
          items: [
            { id: 1301, source_invoice_item_id: 1201, product_id: 10, unit_type: "BAO", quantity: "1.000", unit_price: "100.00", line_total: "100.00", product_code_snapshot: "HISTORY-A", product_name_snapshot: "Gao History A" },
          ],
        }),
      );
    }
    if (pathname.endsWith("/customers/21")) {
      return Promise.resolve(jsonResponse({ id: 21, customer_name: "Tran History", phone: "0909000000", address: "Ha Noi", note: "Khach quen", current_balance: "60.00", total_sales: "100.00", is_walk_in: false, is_active: true, created_at: "2026-05-20T09:00:00Z", updated_at: "2026-05-20T09:00:00Z" }));
    }
    if (pathname.endsWith("/inventory/products/10")) {
      return Promise.resolve(jsonResponse({ id: 10, product_code_base: "HISTORY-A", product_name: "Gao History A", unit_mode: "BAO_KG", is_active: true, created_at: "2026-05-20T09:00:00Z", updated_at: "2026-05-20T09:00:00Z", prices: [], balance: null }));
    }
    if (pathname.endsWith("/inventory/products/10/movements")) {
      return Promise.resolve(jsonResponse([{ movement_id: 41, movement_datetime: "2026-05-20T13:00:00Z", movement_type: "STOCK_SET", quantity_delta: "-1.000", unit_type: "BAO", balance_after: "3.000", source_type: "stock_adjustment", source_id: 41, note: "Counted stock", actor: null, created_at: "2026-05-20T13:00:00Z" }]));
    }
    if (pathname.endsWith("/orders/61")) {
      return Promise.resolve(jsonResponse({ id: 61, order_code: "DH20260520-001", customer_id: 21, customer_name_snapshot: "Tran History", order_datetime: "2026-05-20T14:00:00Z", required_delivery_datetime: "2026-05-21T08:00:00Z", note: "Converted order", status: "CONVERTED", source_invoice_id: 12, completed_at: "2026-05-20T14:30:00Z", created_at: "2026-05-20T14:00:00Z", updated_at: "2026-05-20T14:30:00Z", items: [] }));
    }
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("HistoryListPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("renders /history and grouped document labels", async () => {
    mockHistorySession("owner");
    renderRoute("/history");

    expect(await screen.findByRole("heading", { name: /L.ch s./i })).toBeInTheDocument();
    expect(await screen.findByText("HD20260520-001")).toBeInTheDocument();
    expect(screen.getAllByText("Hóa đơn bán hàng").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Phiếu trả hàng").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Thanh toán công nợ").length).toBeGreaterThan(0);
    const invoiceRow = screen.getByText("HD20260520-001").closest("tr");
    expect(invoiceRow?.textContent).toContain("200");
    expect(invoiceRow?.textContent).toContain("30");
    expect(invoiceRow?.textContent).toContain("2");
  });

  it("filters call /api/history with refined params", async () => {
    const fetchMock = mockHistorySession("owner");
    const testUser = userEvent.setup();
    renderRoute("/history");

    await screen.findByRole("heading", { name: /L.ch s./i });
    await testUser.click(screen.getByRole("button", { name: /7 ng.y/i }));
    await testUser.click(screen.getByRole("button", { name: "Phiếu trả hàng" }));
    await testUser.selectOptions(screen.getByLabelText(/Kh.ch h.ng/i), "21");
    await testUser.selectOptions(screen.getByLabelText(/S.n ph.m/i), "10");
    await testUser.clear(screen.getByLabelText(/M. ch.ng t. ho.c t. kh.a/i));
    await testUser.type(screen.getByLabelText(/M. ch.ng t. ho.c t. kh.a/i), "HD20260520");
    await testUser.selectOptions(screen.getByLabelText(/S. d.ng m.i trang/i), "50");

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => {
          const url = new URL(String(call[0]));
          return (
            url.pathname.endsWith("/history")
            && url.searchParams.get("event_type") === "RETURN_INVOICE"
            && url.searchParams.get("customer_id") === "21"
            && url.searchParams.get("product_id") === "10"
            && url.searchParams.get("search") === "HD20260520"
            && url.searchParams.get("page_size") === "50"
          );
        }),
      ).toBe(true);
    });
  });

  it("paginates history rows", async () => {
    const fetchMock = mockHistorySession("owner", paginatedRows(30));
    const testUser = userEvent.setup();
    renderRoute("/history");

    expect(await screen.findByText(/30 giao d.ch t.m th.y/i)).toBeInTheDocument();
    await testUser.click(screen.getByRole("button", { name: "Trang sau" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => {
          const url = new URL(String(call[0]));
          return url.pathname.endsWith("/history") && url.searchParams.get("page") === "2";
        }),
      ).toBe(true);
    });
  });

  it("renders safe open links", async () => {
    mockHistorySession("owner");
    renderRoute("/history");

    const links = await screen.findAllByRole("link", { name: "Mở chi tiết" });
    expect(links[0]).toHaveAttribute("href", "/inventory/products/10");
    expect(links[1]).toHaveAttribute("href", "/customers/21");
    expect(links[3]).toHaveAttribute("href", "/returns/13");
    expect(links[4]).toHaveAttribute("href", "/sales/invoices/12");
  });

  it("drawer shows grouped invoice detail item rows", async () => {
    mockHistorySession("owner");
    const testUser = userEvent.setup();
    renderRoute("/history");

    await testUser.click(await screen.findByText("HD20260520-001"));
    expect(await screen.findByRole("heading", { name: /H.a .*n b.n h.ng/i })).toBeInTheDocument();
    expect(screen.getAllByText("HD20260520-001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Gao History A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bot History B").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("row").some((row) => row.getAttribute("data-selected") === "true")).toBe(true);
    await testUser.click(screen.getByRole("button", { name: /^Đóng$/i }));
    expect(screen.queryByRole("heading", { name: /H.a .*n b.n h.ng/i })).not.toBeInTheDocument();
  });

  it("opening invoice detail from history returns to history on Quay lại", async () => {
    mockHistorySession("owner");
    const testUser = userEvent.setup();
    renderRoute("/history");

    const links = await screen.findAllByRole("link", { name: "Mở chi tiết" });
    await testUser.click(links[4]);

    expect(await screen.findByRole("heading", { name: /Chi ti.t h.a ..n/i })).toBeInTheDocument();
    await testUser.click(screen.getByRole("link", { name: /Quay l.i l.ch s./i }));
    expect(await screen.findByRole("heading", { name: /L.ch s./i })).toBeInTheDocument();
    expect(screen.getByText("HD20260520-001")).toBeInTheDocument();
  });
});
