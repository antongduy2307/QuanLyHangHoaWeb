import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { login as loginRequest } from "../api/auth";
import { ApiError } from "../api/errors";
import { apiRequest, buildApiUrl } from "../api/client";
import { setRefreshToken } from "../auth/tokenStore";
import { normalizeApiBaseUrl, parseBooleanFlag } from "../config/env";
import type { UserRole } from "../domain/roles";
import { renderRoute } from "../tests/testUtils";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function user(role: UserRole = "owner") {
  return {
    id: 1,
    username: `${role}_user`,
    display_name: `${role} user`,
    role,
    is_active: true,
  };
}

function dashboardSummaryFixture() {
  return {
    total_products: 2,
    total_customers: 3,
    total_customer_debt: "85000.00",
    total_inventory_items: 2,
    today_sales_total: "250000.00",
    month_sales_total: "1250000.00",
    today_return_total: "50000.00",
    month_return_total: "150000.00",
    invoice_count_today: 2,
    positive_debt_customer_count: 1,
  };
}

function customerDebtReportFixture() {
  return [
    {
      customer_id: 21,
      customer_name: "Cong ty Minh Anh",
      phone: "0909000000",
      current_balance: "85000.00",
      total_sales: "500000.00",
      is_active: true,
    },
  ];
}

function inventorySummaryReportFixture() {
  return [
    {
      product_id: 10,
      product_code_base: "GAO-01",
      product_name: "Gao Thom",
      unit_mode: "BAO_KG",
      is_active: true,
      balance_value: "5.000",
      balance_unit: "BAO",
      prices: [
        { unit_type: "BAO", price: "250000.00", is_enabled: true },
        { unit_type: "KG", price: "10000.00", is_enabled: true },
      ],
    },
  ];
}

function salesSummaryReportFixture() {
  return {
    total_sales: "250000.00",
    total_paid: "150000.00",
    invoice_count: 1,
    average_invoice_total: "250000.00",
    by_day: [{ date: "2026-05-17", invoice_count: 1, total_sales: "250000.00", total_paid: "150000.00" }],
  };
}

function returnsSummaryReportFixture() {
  return {
    total_returns: "50000.00",
    return_count: 1,
    by_day: [{ date: "2026-05-17", return_count: 1, total_returns: "50000.00" }],
  };
}

function mockAuthenticatedSession(role: UserRole = "owner") {
  setRefreshToken("stored-refresh");
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/auth/refresh")) {
      return Promise.resolve(
        jsonResponse({
          access_token: "new-access",
          refresh_token: "new-refresh",
          token_type: "bearer",
          expires_in: 1800,
        }),
      );
    }
    if (url.endsWith("/auth/me")) {
      return Promise.resolve(jsonResponse(user(role)));
    }
    if (url.endsWith("/auth/logout")) {
      return Promise.resolve(jsonResponse({ status: "ok" }));
    }
    if (url.endsWith("/reports/dashboard-summary")) {
      return Promise.resolve(jsonResponse(dashboardSummaryFixture()));
    }
    if (url.endsWith("/reports/customer-debts")) {
      return Promise.resolve(jsonResponse(customerDebtReportFixture()));
    }
    if (url.endsWith("/reports/inventory-summary")) {
      return Promise.resolve(jsonResponse(inventorySummaryReportFixture()));
    }
    if (url.includes("/reports/sales-summary")) {
      return Promise.resolve(jsonResponse(salesSummaryReportFixture()));
    }
    if (url.includes("/reports/returns-summary")) {
      return Promise.resolve(jsonResponse(returnsSummaryReportFixture()));
    }
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function productFixture() {
  return {
    id: 10,
    product_code_base: "GAO-01",
    product_name: "Gao Thom",
    unit_mode: "BAO_KG",
    is_active: true,
    created_at: "2026-05-17T00:00:00Z",
    updated_at: "2026-05-17T00:00:00Z",
    prices: [
      { unit_type: "BAO", price: "250000.00", is_enabled: true },
      { unit_type: "KG", price: "10000.00", is_enabled: true },
    ],
    balance: {
      product_id: 10,
      on_hand_bao_decimal: "5.000",
      on_hand_bich_integer: null,
      derived_kg_balance: "125.000",
      updated_at: "2026-05-17T00:00:00Z",
    },
  };
}

function bichProductFixture() {
  return {
    id: 11,
    product_code_base: "BOT-01",
    product_name: "Bot Giat",
    unit_mode: "BICH",
    is_active: true,
    created_at: "2026-05-17T00:00:00Z",
    updated_at: "2026-05-17T00:00:00Z",
    prices: [{ unit_type: "BICH", price: "50000.00", is_enabled: true }],
    balance: {
      product_id: 11,
      on_hand_bao_decimal: null,
      on_hand_bich_integer: "10.000",
      derived_kg_balance: null,
      updated_at: "2026-05-17T00:00:00Z",
    },
  };
}

function inactiveProductFixture() {
  return {
    ...productFixture(),
    id: 12,
    product_code_base: "OLD-01",
    product_name: "Hang Ngung Dung",
    is_active: false,
  };
}

function inventoryMovementFixture() {
  return [
    {
      movement_id: 92,
      movement_datetime: "2026-05-17T11:00:00Z",
      movement_type: "STOCK_SET",
      quantity_delta: "-25.000",
      unit_type: "KG",
      balance_after: "1.000",
      source_type: "stock_adjustment",
      source_id: 92,
      note: "Kiem kho thuc te",
      actor: null,
      created_at: "2026-05-17T11:00:00Z",
    },
    {
      movement_id: 81,
      movement_datetime: "2026-05-17T10:00:00Z",
      movement_type: "RETURN",
      quantity_delta: "5.000",
      unit_type: "KG",
      balance_after: null,
      source_type: "return",
      source_id: 71,
      note: "Tra mot phan",
      actor: null,
      created_at: "2026-05-17T10:00:00Z",
    },
    {
      movement_id: 61,
      movement_datetime: "2026-05-17T09:00:00Z",
      movement_type: "SALE",
      quantity_delta: "-1.000",
      unit_type: "BAO",
      balance_after: null,
      source_type: "invoice",
      source_id: 51,
      note: "Giao buoi sang",
      actor: null,
      created_at: "2026-05-17T09:00:00Z",
    },
    {
      movement_id: 91,
      movement_datetime: "2026-05-17T08:00:00Z",
      movement_type: "STOCK_INCREASE",
      quantity_delta: "3.000",
      unit_type: "BAO",
      balance_after: "8.000",
      source_type: "stock_adjustment",
      source_id: 91,
      note: "Nhap kho dau ngay",
      actor: null,
      created_at: "2026-05-17T08:00:00Z",
    },
  ];
}

function mockInventorySession(role: UserRole, products: unknown[] = [productFixture()]) {
  setRefreshToken("stored-refresh");
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/auth/refresh")) {
      return Promise.resolve(
        jsonResponse({
          access_token: "new-access",
          refresh_token: "new-refresh",
          token_type: "bearer",
          expires_in: 1800,
        }),
      );
    }
    if (url.endsWith("/auth/me")) {
      return Promise.resolve(jsonResponse(user(role)));
    }
    if (url.endsWith("/inventory/products/10/movements")) {
      return Promise.resolve(jsonResponse(inventoryMovementFixture()));
    }
    if (url.endsWith("/inventory/products/10/stock/increase") && init?.method === "POST") {
      return Promise.resolve(
        jsonResponse({
          product_id: 10,
          on_hand_bao_decimal: "6.000",
          on_hand_bich_integer: null,
          derived_kg_balance: "150.000",
          updated_at: "2026-05-17T01:00:00Z",
        }),
      );
    }
    if (url.endsWith("/inventory/products/10/stock/decrease") && init?.method === "POST") {
      return Promise.resolve(
        jsonResponse({
          product_id: 10,
          on_hand_bao_decimal: "4.000",
          on_hand_bich_integer: null,
          derived_kg_balance: "100.000",
          updated_at: "2026-05-17T01:00:00Z",
        }),
      );
    }
    if (url.endsWith("/inventory/products/10/stock/set") && init?.method === "POST") {
      return Promise.resolve(
        jsonResponse({
          product_id: 10,
          on_hand_bao_decimal: "1.000",
          on_hand_bich_integer: null,
          derived_kg_balance: "25.000",
          updated_at: "2026-05-17T01:00:00Z",
        }),
      );
    }
    if (url.endsWith("/inventory/products/10") && init?.method === "PATCH") {
      return Promise.resolve(jsonResponse({ ...productFixture(), product_name: "Gao Cap Nhat" }));
    }
    if (url.endsWith("/inventory/products/10") && init?.method === "DELETE") {
      return Promise.resolve(jsonResponse({ product_id: 10, action: "deactivated" }));
    }
    if (url.includes("/inventory/products") && init?.method === "POST") {
      return Promise.resolve(jsonResponse(productFixture(), 201));
    }
    if (url.endsWith("/inventory/products/10")) {
      return Promise.resolve(jsonResponse(productFixture()));
    }
    if (url.endsWith("/inventory/products/12")) {
      return Promise.resolve(jsonResponse(inactiveProductFixture()));
    }
    if (url.includes("/inventory/products")) {
      return Promise.resolve(jsonResponse(products));
    }
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function customerFixture() {
  return {
    id: 21,
    customer_name: "Cong ty Minh Anh",
    phone: "0909000000",
    address: "Ha Noi",
    note: "Khach hang than thiet",
    current_balance: "100000.00",
    total_sales: "500000.00",
    is_walk_in: false,
    is_active: true,
    created_at: "2026-05-17T00:00:00Z",
    updated_at: "2026-05-17T00:00:00Z",
  };
}

function inactiveCustomerFixture() {
  return {
    ...customerFixture(),
    id: 22,
    customer_name: "Khach Ngung Dung",
    is_active: false,
  };
}

function ledgerFixture() {
  return [
    {
      id: 31,
      customer_id: 21,
      event_type: "OPENING_BALANCE",
      ref_type: "CUSTOMER",
      ref_id: 21,
      amount_delta: "100000.00",
      balance_after: "100000.00",
      transaction_datetime: "1900-01-01T00:00:00Z",
      display_order: 0,
      note: "Opening balance",
    },
  ];
}

function debtPaymentFixture() {
  return {
    id: 41,
    customer_id: 21,
    amount: "25000.00",
    payment_datetime: "2026-05-17T08:00:00Z",
    note: "Tien mat",
    is_deleted: false,
    created_at: "2026-05-17T08:00:00Z",
    updated_at: "2026-05-17T08:00:00Z",
  };
}

function invoiceFixture() {
  return {
    id: 51,
    invoice_code: "HD20260517-001",
    customer_id: 21,
    customer_snapshot_name: "Cong ty Minh Anh",
    invoice_datetime: "2026-05-17T09:00:00Z",
    total_amount: "250000.00",
    paid_amount: "100000.00",
    payment_method: "CASH",
    status: "COMPLETED",
    note: "Giao buoi sang",
    created_at: "2026-05-17T09:00:00Z",
    updated_at: "2026-05-17T09:00:00Z",
    items: [
      {
        id: 61,
        product_id: 10,
        unit_type: "BAO",
        quantity: "1.000",
        unit_price: "250000.00",
        line_total: "250000.00",
        product_code_snapshot: "GAO-01",
        product_name_snapshot: "Gao Thom",
      },
    ],
  };
}

function olderInvoiceFixture() {
  return {
    ...invoiceFixture(),
    id: 52,
    invoice_code: "HD20250101-001",
    customer_snapshot_name: "Khach Cu",
    invoice_datetime: "2025-01-01T09:00:00Z",
  };
}

function inactiveHistoricalInvoiceFixture() {
  return {
    ...invoiceFixture(),
    customer_id: 22,
    customer_snapshot_name: "Khach Ngung Dung",
    items: [
      {
        ...invoiceFixture().items[0],
        product_id: 12,
        product_code_snapshot: "OLD-01",
        product_name_snapshot: "Hang Ngung Dung",
      },
    ],
  };
}

function returnFixture() {
  return {
    id: 71,
    return_code: "TR20260517-001",
    source_invoice_id: 51,
    customer_id: 21,
    customer_snapshot_name: "Cong ty Minh Anh",
    is_quick_return: false,
    return_datetime: "2026-05-17T10:00:00Z",
    total_amount: "50000.00",
    handling_mode: "STORE_CREDIT",
    note: "Tra mot phan",
    created_at: "2026-05-17T10:00:00Z",
    updated_at: "2026-05-17T10:00:00Z",
    items: [
      {
        id: 81,
        source_invoice_item_id: 61,
        product_id: 10,
        unit_type: "KG",
        quantity: "5.000",
        unit_price: "10000.00",
        line_total: "50000.00",
        product_code_snapshot: "GAO-01",
        product_name_snapshot: "Gao Thom",
      },
    ],
  };
}

function inactiveHistoricalReturnFixture() {
  return {
    ...returnFixture(),
    customer_id: 22,
    customer_snapshot_name: "Khach Ngung Dung",
    items: [
      {
        ...returnFixture().items[0],
        product_id: 12,
        product_code_snapshot: "OLD-01",
        product_name_snapshot: "Hang Ngung Dung",
      },
    ],
  };
}

function mockCustomerSession(
  role: UserRole,
  customers: unknown[] = [customerFixture()],
  ledger: unknown[] = ledgerFixture(),
  debtPayments: unknown[] = [debtPaymentFixture()],
) {
  setRefreshToken("stored-refresh");
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/auth/refresh")) {
      return Promise.resolve(
        jsonResponse({
          access_token: "new-access",
          refresh_token: "new-refresh",
          token_type: "bearer",
          expires_in: 1800,
        }),
      );
    }
    if (url.endsWith("/auth/me")) {
      return Promise.resolve(jsonResponse(user(role)));
    }
    if (url.endsWith("/customers/21/balance-adjustments") && init?.method === "POST") {
      return Promise.resolve(
        jsonResponse(
          {
            customer: { ...customerFixture(), current_balance: "125000.00" },
            ledger: {
              ...ledgerFixture()[0],
              id: 32,
              event_type: "BALANCE_ADJUSTMENT",
              ref_type: "BALANCE_ADJUSTMENT",
              amount_delta: "25000.00",
              balance_after: "125000.00",
              note: "manual correction",
            },
          },
          201,
        ),
      );
    }
    if (url.endsWith("/customers/21/ledger")) {
      return Promise.resolve(jsonResponse(ledger));
    }
    if (url.endsWith("/customers/21/debt-payments/41") && init?.method === "PATCH") {
      return Promise.resolve(
        jsonResponse({ payment: { ...debtPaymentFixture(), amount: "30000.00" }, ledger: null, current_balance: "70000.00" }),
      );
    }
    if (url.endsWith("/customers/21/debt-payments/41") && init?.method === "DELETE") {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (url.endsWith("/customers/21/debt-payments") && init?.method === "POST") {
      return Promise.resolve(jsonResponse({ payment: debtPaymentFixture(), ledger: null, current_balance: "75000.00" }, 201));
    }
    if (url.endsWith("/customers/21/debt-payments")) {
      return Promise.resolve(jsonResponse(debtPayments));
    }
    if (url.endsWith("/customers/21") && init?.method === "PATCH") {
      return Promise.resolve(jsonResponse({ ...customerFixture(), customer_name: "Cong ty Cap Nhat", phone: "0911" }));
    }
    if (url.endsWith("/customers/21") && init?.method === "DELETE") {
      return Promise.resolve(jsonResponse({ customer_id: 21, action: "deactivated" }));
    }
    if (url.endsWith("/customers/404")) {
      return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Customer not found" } }, 404));
    }
    if (url.endsWith("/customers/21")) {
      return Promise.resolve(jsonResponse(customerFixture()));
    }
    if (url.includes("/customers") && init?.method === "POST") {
      return Promise.resolve(jsonResponse(customerFixture(), 201));
    }
    if (url.includes("/customers")) {
      return Promise.resolve(jsonResponse(customers));
    }
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function mockSalesSession(role: UserRole, invoices: unknown[] = [invoiceFixture()]) {
  setRefreshToken("stored-refresh");
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/auth/refresh")) {
      return Promise.resolve(
        jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
      );
    }
    if (url.endsWith("/auth/me")) {
      return Promise.resolve(jsonResponse(user(role)));
    }
    if (url.includes("/inventory/products")) {
      return Promise.resolve(jsonResponse([productFixture(), bichProductFixture()]));
    }
    if (url.includes("/customers")) {
      return Promise.resolve(jsonResponse([customerFixture()]));
    }
    if (url.endsWith("/sales/invoices/51") && init?.method === "PATCH") {
      return Promise.resolve(jsonResponse({ ...invoiceFixture(), paid_amount: "250000.00" }));
    }
    if (url.endsWith("/sales/invoices/51") && init?.method === "DELETE") {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (url.endsWith("/sales/invoices") && init?.method === "POST") {
      return Promise.resolve(jsonResponse(invoiceFixture(), 201));
    }
    if (url.endsWith("/sales/invoices/404")) {
      return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Invoice not found" } }, 404));
    }
    if (url.endsWith("/sales/invoices/51")) {
      return Promise.resolve(jsonResponse(invoiceFixture()));
    }
    if (url.includes("/sales/invoices?") || url.endsWith("/sales/invoices")) {
      return Promise.resolve(jsonResponse(invoices));
    }
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function mockReturnsSession(role: UserRole, returns: unknown[] = [returnFixture()]) {
  setRefreshToken("stored-refresh");
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/auth/refresh")) {
      return Promise.resolve(
        jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
      );
    }
    if (url.endsWith("/auth/me")) {
      return Promise.resolve(jsonResponse(user(role)));
    }
    if (url.includes("/inventory/products")) {
      return Promise.resolve(jsonResponse([productFixture(), bichProductFixture()]));
    }
    if (url.includes("/customers")) {
      return Promise.resolve(jsonResponse([customerFixture()]));
    }
    if (url.endsWith("/sales/invoices/51")) {
      return Promise.resolve(jsonResponse(invoiceFixture()));
    }
    if (url.endsWith("/sales/invoices")) {
      return Promise.resolve(jsonResponse([invoiceFixture()]));
    }
    if (url.endsWith("/returns/71") && init?.method === "PATCH") {
      return Promise.resolve(jsonResponse({ ...returnFixture(), note: "Da cap nhat" }));
    }
    if (url.endsWith("/returns/71") && init?.method === "DELETE") {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (url.endsWith("/returns") && init?.method === "POST") {
      return Promise.resolve(jsonResponse(returnFixture(), 201));
    }
    if (url.endsWith("/returns/404")) {
      return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Return not found" } }, 404));
    }
    if (url.endsWith("/returns/71")) {
      return Promise.resolve(jsonResponse(returnFixture()));
    }
    if (url.includes("/returns?") || url.endsWith("/returns")) {
      return Promise.resolve(jsonResponse(returns));
    }
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("admin shell", () => {
  it("redirects anonymous users to login", async () => {
    renderRoute("/inventory/products");

    expect(await screen.findByRole("heading", { name: "Dang nhap" })).toBeInTheDocument();
  });

  it("renders the protected app shell for an allowed role", async () => {
    mockAuthenticatedSession("owner");
    renderRoute("/");

    expect(await screen.findByText("QuanLyHangHoa")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Tong quan" })).toBeInTheDocument();
  });

  it("renders sidebar navigation links", async () => {
    mockAuthenticatedSession("admin");
    renderRoute("/");

    await screen.findByRole("heading", { name: "Tong quan" });
    expect(screen.getByRole("link", { name: "Tong quan" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Hang hoa" })).toHaveAttribute("href", "/inventory/products");
    expect(screen.getByRole("link", { name: "Khach hang" })).toHaveAttribute("href", "/customers");
    expect(screen.getByRole("link", { name: "Ban hang" })).toHaveAttribute("href", "/sales/invoices");
    expect(screen.getByRole("link", { name: "Tra hang" })).toHaveAttribute("href", "/returns");
    expect(screen.getByRole("link", { name: "Bao cao" })).toHaveAttribute("href", "/reports");
    expect(screen.getByRole("link", { name: "Cai dat" })).toHaveAttribute("href", "/settings");
  });

  it.each([
    ["/", "Tong quan"],
    ["/inventory/products", "Hang hoa"],
    ["/customers", "Khach hang"],
    ["/sales/invoices", "Ban hang"],
    ["/returns", "Tra hang"],
    ["/reports", "Bao cao"],
    ["/settings", "Cai dat"],
  ])("renders placeholder page for %s", async (path, heading) => {
    mockAuthenticatedSession("read_only");
    renderRoute(path);

    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
  });

  it("shows access denied for a forbidden admin shell role", async () => {
    mockAuthenticatedSession("employee");
    renderRoute("/");

    expect(await screen.findByRole("heading", { name: "Khong co quyen truy cap" })).toBeInTheDocument();
  });
});

describe("reports and dashboard", () => {
  it("renders dashboard loading state", async () => {
    setRefreshToken("stored-refresh");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse(user("owner")));
        if (url.endsWith("/reports/dashboard-summary")) return new Promise(() => undefined);
        return Promise.resolve(jsonResponse({}));
      }),
    );

    renderRoute("/");

    expect(await screen.findByText("Dang tai tong quan...")).toBeInTheDocument();
  });

  it("renders dashboard summary cards", async () => {
    mockAuthenticatedSession("read_only");
    renderRoute("/");

    expect(await screen.findByText("Doanh thu hom nay")).toBeInTheDocument();
    expect(screen.getByText("250.000")).toBeInTheDocument();
    expect(screen.getByText("Cong no hien tai")).toBeInTheDocument();
    expect(screen.getByText("85.000")).toBeInTheDocument();
    expect(screen.getByText("Hoa don hom nay")).toBeInTheDocument();
  });

  it("renders dashboard backend error", async () => {
    setRefreshToken("stored-refresh");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse(user("owner")));
        if (url.endsWith("/reports/dashboard-summary")) {
          return Promise.resolve(jsonResponse({ error: { code: "boom", message: "Dashboard failed" } }, 500));
        }
        return Promise.resolve(jsonResponse({}));
      }),
    );

    renderRoute("/");

    expect(await screen.findByText("Dashboard failed")).toBeInTheDocument();
  });

  it("renders report tables for debts and inventory", async () => {
    mockAuthenticatedSession("read_only");
    renderRoute("/reports");

    expect(await screen.findByRole("heading", { name: "Bao cao" })).toBeInTheDocument();
    expect(await screen.findByText("Cong ty Minh Anh")).toBeInTheDocument();
    expect(screen.getByText("0909000000")).toBeInTheDocument();
    expect(screen.getByText("GAO-01")).toBeInTheDocument();
    expect(screen.getByText("Gao Thom")).toBeInTheDocument();
  });

  it("sales report date filter triggers query", async () => {
    const fetchMock = mockAuthenticatedSession("owner");
    const testUser = userEvent.setup();
    renderRoute("/reports");

    await screen.findByRole("heading", { name: "Bao cao" });
    await testUser.type(screen.getByLabelText("Tu ngay"), "2026-05-01");
    await testUser.type(screen.getByLabelText("Den ngay"), "2026-05-31");

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/reports/sales-summary?date_from=2026-05-01"))).toBe(true);
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("date_to=2026-05-31"))).toBe(true);
    });
  });

  it("read only can view reports and employee is blocked by shell", async () => {
    mockAuthenticatedSession("read_only");
    renderRoute("/reports");
    expect(await screen.findByRole("heading", { name: "Bao cao" })).toBeInTheDocument();

    cleanup();
    mockAuthenticatedSession("employee");
    renderRoute("/reports");
    expect(await screen.findByRole("heading", { name: "Khong co quyen truy cap" })).toBeInTheDocument();
  });

  it("renders reports backend error", async () => {
    setRefreshToken("stored-refresh");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse(user("owner")));
        if (url.endsWith("/reports/customer-debts")) {
          return Promise.resolve(jsonResponse({ error: { code: "boom", message: "Reports failed" } }, 500));
        }
        if (url.endsWith("/reports/inventory-summary")) return Promise.resolve(jsonResponse(inventorySummaryReportFixture()));
        if (url.includes("/reports/sales-summary")) return Promise.resolve(jsonResponse(salesSummaryReportFixture()));
        if (url.includes("/reports/returns-summary")) return Promise.resolve(jsonResponse(returnsSummaryReportFixture()));
        return Promise.resolve(jsonResponse({}));
      }),
    );

    renderRoute("/reports");

    expect(await screen.findByText("Reports failed")).toBeInTheDocument();
  });
});

describe("customers", () => {
  it("renders customer loading state", async () => {
    setRefreshToken("stored-refresh");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) {
          return Promise.resolve(jsonResponse(user("owner")));
        }
        if (url.includes("/customers")) {
          return new Promise(() => undefined);
        }
        return Promise.resolve(jsonResponse({}));
      }),
    );
    renderRoute("/customers");

    expect(await screen.findByText("Dang tai danh sach khach hang...")).toBeInTheDocument();
  });

  it("renders customer success state", async () => {
    mockCustomerSession("owner");
    renderRoute("/customers");

    expect(await screen.findByText("Cong ty Minh Anh")).toBeInTheDocument();
    expect(screen.getByText("0909000000")).toBeInTheDocument();
    expect(screen.getByText("Ha Noi")).toBeInTheDocument();
    expect(screen.getByText("100.000")).toBeInTheDocument();
  });

  it("renders customer empty state", async () => {
    mockCustomerSession("owner", []);
    renderRoute("/customers");

    expect(await screen.findByText("Chua co khach hang phu hop.")).toBeInTheDocument();
  });

  it("renders customer API error", async () => {
    setRefreshToken("stored-refresh");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) {
          return Promise.resolve(jsonResponse(user("owner")));
        }
        if (url.includes("/customers")) {
          return Promise.resolve(jsonResponse({ error: { code: "boom", message: "Customer API failed" } }, 500));
        }
        return Promise.resolve(jsonResponse({}));
      }),
    );

    renderRoute("/customers");

    expect(await screen.findByText("Customer API failed")).toBeInTheDocument();
  });

  it("sends customer search and positive debt filters", async () => {
    const fetchMock = mockCustomerSession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/customers");

    await screen.findByRole("heading", { name: "Khach hang" });
    await testUser.type(screen.getByPlaceholderText("Ten, dien thoai"), "minh");
    await testUser.click(screen.getByLabelText("Chi hien khach dang no"));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("search=minh"))).toBe(true);
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("only_positive_debt=true"))).toBe(true);
    });
  });

  it("sends include inactive query when customer inactive toggle is enabled", async () => {
    const fetchMock = mockCustomerSession("owner", [customerFixture(), inactiveCustomerFixture()]);
    const testUser = userEvent.setup();
    renderRoute("/customers");

    await screen.findByRole("heading", { name: "Khach hang" });
    await testUser.click(screen.getByLabelText("Hien khach ngung dung"));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("include_inactive=true"))).toBe(true);
    });
  });

  it("shows create customer action to owner and admin but not read only", async () => {
    mockCustomerSession("owner", []);
    renderRoute("/customers");
    expect(await screen.findByRole("link", { name: "Tạo khách hàng" })).toBeInTheDocument();

    cleanup();
    mockCustomerSession("admin", []);
    renderRoute("/customers");
    expect(await screen.findByRole("link", { name: "Tạo khách hàng" })).toBeInTheDocument();

    cleanup();
    mockCustomerSession("read_only", []);
    renderRoute("/customers");
    await screen.findByRole("heading", { name: "Khach hang" });
    expect(screen.queryByRole("link", { name: "Tạo khách hàng" })).not.toBeInTheDocument();
  });

  it("denies read only access to customer create route", async () => {
    mockCustomerSession("read_only", []);
    renderRoute("/customers/new");

    expect(await screen.findByRole("heading", { name: "Khong co quyen truy cap" })).toBeInTheDocument();
  });

  it("validates required customer name", async () => {
    mockCustomerSession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/customers/new");

    await screen.findByRole("heading", { name: "Tạo khách hàng" });
    await testUser.click(screen.getByRole("button", { name: "Tạo khách hàng" }));

    expect(await screen.findByText("Ten khach hang la bat buoc.")).toBeInTheDocument();
  });

  it("validates numeric opening balance", async () => {
    mockCustomerSession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/customers/new");

    await screen.findByRole("heading", { name: "Tạo khách hàng" });
    await testUser.type(screen.getByLabelText("Ten khach hang"), "Khach A");
    await testUser.clear(screen.getByLabelText("So du ban dau"));
    await testUser.type(screen.getByLabelText("So du ban dau"), "abc");
    await testUser.click(screen.getByRole("button", { name: "Tạo khách hàng" }));

    expect(await screen.findByText("So du ban dau phai la so hop le.")).toBeInTheDocument();
  });

  it("creates a customer and redirects to list", async () => {
    const fetchMock = mockCustomerSession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/customers/new");

    await screen.findByRole("heading", { name: "Tạo khách hàng" });
    await testUser.type(screen.getByLabelText("Ten khach hang"), "Khach Moi");
    await testUser.type(screen.getByLabelText("Dien thoai"), "0909");
    await testUser.click(screen.getByRole("button", { name: "Tạo khách hàng" }));

    expect(await screen.findByRole("heading", { name: "Khach hang" })).toBeInTheDocument();
    const createCall = fetchMock.mock.calls.find((call) => String(call[0]).endsWith("/customers") && call[1]?.method === "POST");
    expect(createCall).toBeTruthy();
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      customer_name: "Khach Moi",
      phone: "0909",
      address: null,
      note: null,
      opening_balance: "0",
      total_sales: "0",
    });
  });

  it("renders customer detail and ledger rows", async () => {
    mockCustomerSession("read_only");
    renderRoute("/customers/21");

    expect(await screen.findByText("Cong ty Minh Anh")).toBeInTheDocument();
    expect(screen.getByText("Tien mat")).toBeInTheDocument();
    expect(screen.getByText("#41")).toBeInTheDocument();
    expect(screen.getByText("OPENING_BALANCE")).toBeInTheDocument();
    expect(screen.getByText("CUSTOMER #21")).toBeInTheDocument();
    expect(screen.getAllByText("100.000").length).toBeGreaterThan(0);
  });

  it("shows customer detail actions to owner and admin but not read only", async () => {
    mockCustomerSession("owner");
    renderRoute("/customers/21");
    expect(await screen.findByRole("link", { name: "Sua khach hang" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xoa khach hang" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Điều chỉnh công nợ" })).toBeInTheDocument();

    cleanup();
    mockCustomerSession("admin");
    renderRoute("/customers/21");
    expect(await screen.findByRole("link", { name: "Sua khach hang" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xoa khach hang" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Điều chỉnh công nợ" })).toBeInTheDocument();

    cleanup();
    mockCustomerSession("read_only");
    renderRoute("/customers/21");
    await screen.findByRole("heading", { name: "Chi tiet khach hang" });
    expect(screen.queryByRole("link", { name: "Sua khach hang" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xoa khach hang" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Điều chỉnh công nợ" })).not.toBeInTheDocument();
  });

  it("preloads customer edit form", async () => {
    mockCustomerSession("owner");
    renderRoute("/customers/21/edit");

    expect(await screen.findByDisplayValue("Cong ty Minh Anh")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0909000000")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ha Noi")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Khach hang than thiet")).toBeInTheDocument();
    expect(screen.getByDisplayValue("100000.00")).toBeDisabled();
  });

  it("edits customer profile and redirects to detail", async () => {
    const fetchMock = mockCustomerSession("owner");
    const testUser = userEvent.setup();
    renderRoute("/customers/21/edit");

    await screen.findByRole("heading", { name: "Sua khach hang" });
    await screen.findByDisplayValue("Cong ty Minh Anh");
    await testUser.clear(screen.getByLabelText("Ten khach hang"));
    await testUser.type(screen.getByLabelText("Ten khach hang"), "Cong ty Cap Nhat");
    await testUser.clear(screen.getByLabelText("Dien thoai"));
    await testUser.type(screen.getByLabelText("Dien thoai"), "0911");
    await testUser.click(screen.getByRole("button", { name: "Luu khach hang" }));

    expect(await screen.findByRole("heading", { name: "Chi tiet khach hang" })).toBeInTheDocument();
    const patchCall = fetchMock.mock.calls.find((call) => String(call[0]).endsWith("/customers/21") && call[1]?.method === "PATCH");
    expect(patchCall).toBeTruthy();
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
      customer_name: "Cong ty Cap Nhat",
      phone: "0911",
      address: "Ha Noi",
      note: "Khach hang than thiet",
    });
  });

  it("displays customer edit backend error", async () => {
    setRefreshToken("stored-refresh");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse(user("owner")));
        if (url.endsWith("/customers/21") && init?.method === "PATCH") {
          return Promise.resolve(jsonResponse({ error: { code: "conflict", message: "Customer update failed" } }, 409));
        }
        if (url.endsWith("/customers/21")) return Promise.resolve(jsonResponse(customerFixture()));
        return Promise.resolve(jsonResponse([]));
      }),
    );
    const testUser = userEvent.setup();
    renderRoute("/customers/21/edit");

    await screen.findByDisplayValue("Cong ty Minh Anh");
    await testUser.click(screen.getByRole("button", { name: "Luu khach hang" }));

    expect(await screen.findByText("Customer update failed")).toBeInTheDocument();
  });

  it("denies read only access to customer edit route", async () => {
    mockCustomerSession("read_only");
    renderRoute("/customers/21/edit");

    expect(await screen.findByRole("heading", { name: "Khong co quyen truy cap" })).toBeInTheDocument();
  });

  it("customer delete confirmation cancel does not call API", async () => {
    const fetchMock = mockCustomerSession("owner");
    const testUser = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    renderRoute("/customers/21");

    await testUser.click(await screen.findByRole("button", { name: "Xoa khach hang" }));

    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/customers/21") && call[1]?.method === "DELETE")).toBe(false);
  });

  it("customer delete confirmation success redirects to list with result message", async () => {
    const fetchMock = mockCustomerSession("owner");
    const testUser = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    renderRoute("/customers/21");

    await testUser.click(await screen.findByRole("button", { name: "Xoa khach hang" }));

    expect(await screen.findByRole("heading", { name: "Khach hang" })).toBeInTheDocument();
    expect(await screen.findByText("Khach hang da duoc ngung dung.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/customers/21") && call[1]?.method === "DELETE")).toBe(true);
  });

  it("read only sees debt payment list but no mutation buttons", async () => {
    mockCustomerSession("read_only");
    renderRoute("/customers/21");

    expect(await screen.findByText("Tien mat")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Them thanh toan" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sua" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xoa" })).not.toBeInTheDocument();
  });

  it("owner sees create edit and delete debt payment controls", async () => {
    mockCustomerSession("owner");
    renderRoute("/customers/21");

    expect(await screen.findByRole("button", { name: "Them thanh toan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sua" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xoa" })).toBeInTheDocument();
  });

  it("adjusts customer balance and refetches customer detail", async () => {
    const fetchMock = mockCustomerSession("owner");
    const testUser = userEvent.setup();
    renderRoute("/customers/21");

    await testUser.click(await screen.findByRole("button", { name: "Điều chỉnh công nợ" }));
    await testUser.clear(screen.getByLabelText("So du muc tieu"));
    await testUser.type(screen.getByLabelText("So du muc tieu"), "125000");
    await testUser.type(screen.getByLabelText("Ghi chu"), "manual correction");
    await testUser.click(screen.getByRole("button", { name: "Luu dieu chinh" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/customers/21/balance-adjustments") && call[1]?.method === "POST"),
      ).toBe(true);
      expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/customers/21")).length).toBeGreaterThan(1);
      expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/customers/21/ledger")).length).toBeGreaterThan(1);
      expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/customers/21/debt-payments")).length).toBeGreaterThan(1);
    });
    const adjustmentCall = fetchMock.mock.calls.find(
      (call) => String(call[0]).endsWith("/customers/21/balance-adjustments") && call[1]?.method === "POST",
    );
    expect(JSON.parse(String(adjustmentCall?.[1]?.body))).toEqual({
      target_balance: "125000",
      note: "manual correction",
    });
    expect(await screen.findByText("Da dieu chinh cong no.")).toBeInTheDocument();
  });

  it("creates a debt payment and refetches customer detail", async () => {
    const fetchMock = mockCustomerSession("owner", [customerFixture()], ledgerFixture(), []);
    const testUser = userEvent.setup();
    renderRoute("/customers/21");

    await testUser.click(await screen.findByRole("button", { name: "Them thanh toan" }));
    await testUser.type(screen.getByLabelText("So tien thanh toan"), "25000");
    await testUser.click(screen.getAllByRole("button", { name: "Them thanh toan" })[1]);

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/customers/21/debt-payments") && call[1]?.method === "POST")).toBe(true);
      expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/customers/21")).length).toBeGreaterThan(1);
      expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/customers/21/ledger")).length).toBeGreaterThan(1);
      expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/customers/21/debt-payments")).length).toBeGreaterThan(1);
    });
    expect(await screen.findByText("Da them thanh toan cong no.")).toBeInTheDocument();
  });

  it("rejects non-positive debt payment amount", async () => {
    mockCustomerSession("owner", [customerFixture()], ledgerFixture(), []);
    const testUser = userEvent.setup();
    renderRoute("/customers/21");

    await testUser.click(await screen.findByRole("button", { name: "Them thanh toan" }));
    await testUser.type(screen.getByLabelText("So tien thanh toan"), "0");
    await testUser.click(screen.getAllByRole("button", { name: "Them thanh toan" })[1]);

    expect(await screen.findByText("So tien thanh toan phai lon hon 0.")).toBeInTheDocument();
  });

  it("shows backend validation error for debt payment create", async () => {
    setRefreshToken("stored-refresh");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse(user("owner")));
        if (url.endsWith("/customers/21/ledger")) return Promise.resolve(jsonResponse(ledgerFixture()));
        if (url.endsWith("/customers/21/debt-payments") && init?.method === "POST") {
          return Promise.resolve(jsonResponse({ error: { code: "validation_error", message: "Amount must be > 0" } }, 422));
        }
        if (url.endsWith("/customers/21/debt-payments")) return Promise.resolve(jsonResponse([]));
        if (url.endsWith("/customers/21")) return Promise.resolve(jsonResponse(customerFixture()));
        return Promise.resolve(jsonResponse([]));
      }),
    );
    const testUser = userEvent.setup();
    renderRoute("/customers/21");

    await testUser.click(await screen.findByRole("button", { name: "Them thanh toan" }));
    await testUser.type(screen.getByLabelText("So tien thanh toan"), "10");
    await testUser.click(screen.getAllByRole("button", { name: "Them thanh toan" })[1]);

    expect(await screen.findByText("Amount must be > 0")).toBeInTheDocument();
  });

  it("edits a debt payment", async () => {
    const fetchMock = mockCustomerSession("admin");
    const testUser = userEvent.setup();
    renderRoute("/customers/21");

    await testUser.click(await screen.findByRole("button", { name: "Sua" }));
    await testUser.clear(screen.getByLabelText("So tien thanh toan"));
    await testUser.type(screen.getByLabelText("So tien thanh toan"), "30000");
    await testUser.click(screen.getByRole("button", { name: "Luu thanh toan" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/customers/21/debt-payments/41") && call[1]?.method === "PATCH")).toBe(true);
      expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/customers/21")).length).toBeGreaterThan(1);
    });
  });

  it("debt payment delete confirmation cancel does not call API", async () => {
    const fetchMock = mockCustomerSession("owner");
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    const testUser = userEvent.setup();
    renderRoute("/customers/21");

    await testUser.click(await screen.findByRole("button", { name: "Xoa" }));

    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/customers/21/debt-payments/41") && call[1]?.method === "DELETE")).toBe(false);
  });

  it("deletes a debt payment after confirmation", async () => {
    const fetchMock = mockCustomerSession("owner");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const testUser = userEvent.setup();
    renderRoute("/customers/21");

    await testUser.click(await screen.findByRole("button", { name: "Xoa" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/customers/21/debt-payments/41") && call[1]?.method === "DELETE")).toBe(true);
      expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/customers/21")).length).toBeGreaterThan(1);
    });
    expect(await screen.findByText("Da xoa thanh toan cong no.")).toBeInTheDocument();
  });

  it("shows debt payment delete error", async () => {
    setRefreshToken("stored-refresh");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse(user("owner")));
        if (url.endsWith("/customers/21/ledger")) return Promise.resolve(jsonResponse(ledgerFixture()));
        if (url.endsWith("/customers/21/debt-payments/41") && init?.method === "DELETE") {
          return Promise.resolve(jsonResponse({ error: { code: "validation_error", message: "Cannot delete payment" } }, 422));
        }
        if (url.endsWith("/customers/21/debt-payments")) return Promise.resolve(jsonResponse([debtPaymentFixture()]));
        if (url.endsWith("/customers/21")) return Promise.resolve(jsonResponse(customerFixture()));
        return Promise.resolve(jsonResponse([]));
      }),
    );
    const testUser = userEvent.setup();
    renderRoute("/customers/21");

    await testUser.click(await screen.findByRole("button", { name: "Xoa" }));

    expect(await screen.findByText("Cannot delete payment")).toBeInTheDocument();
  });

  it("renders customer detail error state", async () => {
    mockCustomerSession("read_only");
    renderRoute("/customers/404");

    expect(await screen.findByText("Customer not found")).toBeInTheDocument();
  });
});

describe("sales invoices", () => {
  it("renders invoice loading state", async () => {
    setRefreshToken("stored-refresh");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) {
          return Promise.resolve(jsonResponse(user("owner")));
        }
        if (url.endsWith("/sales/invoices")) {
          return new Promise(() => undefined);
        }
        return Promise.resolve(jsonResponse({}));
      }),
    );
    renderRoute("/sales/invoices");

    expect(await screen.findByText("Dang tai danh sach hoa don...")).toBeInTheDocument();
  });

  it("renders invoice list success state", async () => {
    mockSalesSession("read_only");
    renderRoute("/sales/invoices");

    expect(await screen.findByText("HD20260517-001")).toBeInTheDocument();
    expect(screen.getByText("Cong ty Minh Anh")).toBeInTheDocument();
    expect(screen.getByText("250.000")).toBeInTheDocument();
    expect(screen.getByText("100.000")).toBeInTheDocument();
    expect(screen.getByText("Hoan tat")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Tao hoa don" })).not.toBeInTheDocument();
  });

  it("sends invoice search and date range to backend query", async () => {
    const fetchMock = mockSalesSession("owner", [invoiceFixture(), olderInvoiceFixture()]);
    const testUser = userEvent.setup();
    renderRoute("/sales/invoices");

    expect(await screen.findByText("HD20260517-001")).toBeInTheDocument();
    expect(screen.getByText("HD20250101-001")).toBeInTheDocument();

    await testUser.type(screen.getByPlaceholderText("Ma hoa don hoac khach hang"), "Minh Anh");
    await testUser.type(screen.getByLabelText("Tu ngay"), "2026-01-01");

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => {
          const url = String(call[0]);
          return url.includes("/sales/invoices?") && url.includes("search=Minh+Anh") && url.includes("date_from=2026-01-01");
        }),
      ).toBe(true);
    });
  });

  it("shows no-results empty state for invoice filters", async () => {
    mockSalesSession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/sales/invoices");

    await screen.findByText("Chua co hoa don ban hang.");
    await testUser.type(screen.getByPlaceholderText("Ma hoa don hoac khach hang"), "khong-co");

    expect(await screen.findByText("Khong co hoa don phu hop bo loc hien tai.")).toBeInTheDocument();
  });

  it("shows invoice row view action and owner edit action", async () => {
    mockSalesSession("owner");
    renderRoute("/sales/invoices");

    expect(await screen.findByRole("link", { name: "Xem" })).toHaveAttribute("href", "/sales/invoices/51");
    expect(screen.getByRole("link", { name: "Sua" })).toHaveAttribute("href", "/sales/invoices/51/edit");

    cleanup();
    mockSalesSession("read_only");
    renderRoute("/sales/invoices");
    expect(await screen.findByRole("link", { name: "Xem" })).toHaveAttribute("href", "/sales/invoices/51");
    expect(screen.queryByRole("link", { name: "Sua" })).not.toBeInTheDocument();
  });

  it("shows invoice create action to owner and admin but not read only", async () => {
    mockSalesSession("owner", []);
    renderRoute("/sales/invoices");
    expect(await screen.findByRole("link", { name: "Tao hoa don" })).toBeInTheDocument();

    cleanup();
    mockSalesSession("admin", []);
    renderRoute("/sales/invoices");
    expect(await screen.findByRole("link", { name: "Tao hoa don" })).toBeInTheDocument();

    cleanup();
    mockSalesSession("read_only", []);
    renderRoute("/sales/invoices");
    await screen.findByRole("heading", { name: "Ban hang" });
    expect(screen.queryByRole("link", { name: "Tao hoa don" })).not.toBeInTheDocument();
  });

  it("invoice create button navigates to create page", async () => {
    mockSalesSession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/sales/invoices");

    await testUser.click(await screen.findByRole("link", { name: "Tao hoa don" }));

    expect(await screen.findByRole("heading", { name: "Tao hoa don" })).toBeInTheDocument();
  });

  it("denies read only access to invoice create route", async () => {
    mockSalesSession("read_only", []);
    renderRoute("/sales/invoices/new");

    expect(await screen.findByRole("heading", { name: "Khong co quyen truy cap" })).toBeInTheDocument();
  });

  it("lets owner access invoice create route", async () => {
    mockSalesSession("owner", []);
    renderRoute("/sales/invoices/new");

    expect(await screen.findByRole("heading", { name: "Tao hoa don" })).toBeInTheDocument();
  });

  it("requires at least one invoice item", async () => {
    mockSalesSession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/sales/invoices/new");

    await screen.findByRole("heading", { name: "Tao hoa don" });
    await testUser.click(await screen.findByRole("button", { name: "Xoa dong" }));
    await testUser.click(screen.getByRole("button", { name: "Tao hoa don" }));

    expect(await screen.findByText("Hoa don can it nhat mot dong hang.")).toBeInTheDocument();
  });

  it("product selection changes available unit types", async () => {
    mockSalesSession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/sales/invoices/new");

    await screen.findByRole("heading", { name: "Tao hoa don" });
    await testUser.selectOptions(await screen.findByLabelText("Hang hoa"), "10");
    expect(screen.getByRole("option", { name: "Bao" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Kg" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Bich" })).not.toBeInTheDocument();

    await testUser.selectOptions(screen.getByLabelText("Hang hoa"), "11");
    expect(screen.getByRole("option", { name: "Bich" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Bao" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Kg" })).not.toBeInTheDocument();
  });

  it("shows product prices and customer phone in invoice selectors", async () => {
    mockSalesSession("owner", []);
    renderRoute("/sales/invoices/new");

    await screen.findByRole("heading", { name: "Tao hoa don" });
    expect(await screen.findByRole("option", { name: "GAO-01 - Gao Thom (BAO: 250000.00 | KG: 10000.00)" })).toBeInTheDocument();

    const testUser = userEvent.setup();
    await testUser.click(screen.getByLabelText("Khach hang"));
    expect(await screen.findByRole("option", { name: "Cong ty Minh Anh - 0909000000" })).toBeInTheDocument();
  });

  it("quick add line preloads the first product and estimate", async () => {
    mockSalesSession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/sales/invoices/new");

    await screen.findByRole("heading", { name: "Tao hoa don" });
    await testUser.click(await screen.findByRole("button", { name: "Them nhanh hang dau tien" }));

    expect(screen.getAllByRole("option", { name: "GAO-01 - Gao Thom (BAO: 250000.00 | KG: 10000.00)" })[1]).toBeInTheDocument();
    expect(screen.getAllByText(/Gia dang bat: BAO: 250000.00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tam tinh dong:/).length).toBeGreaterThan(0);
  });

  it("rejects unpaid walk-in invoice", async () => {
    mockSalesSession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/sales/invoices/new");

    await screen.findByRole("heading", { name: "Tao hoa don" });
    await testUser.selectOptions(await screen.findByLabelText("Hang hoa"), "10");
    await testUser.clear(screen.getByLabelText("Da thanh toan"));
    await testUser.type(screen.getByLabelText("Da thanh toan"), "0");
    await testUser.click(screen.getByRole("button", { name: "Tao hoa don" }));

    expect(await screen.findByText("Hoa don khach le phai thanh toan du hoac thanh toan thua.")).toBeInTheDocument();
  });

  it("shows per-line validation messages for missing product and invalid price", async () => {
    mockSalesSession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/sales/invoices/new");

    await screen.findByRole("heading", { name: "Tao hoa don" });
    await testUser.clear(await screen.findByLabelText("Don gia"));
    await testUser.type(screen.getByLabelText("Don gia"), "abc");
    await testUser.click(screen.getByRole("button", { name: "Tao hoa don" }));

    expect(await screen.findByText("Can chon hang hoa.")).toBeInTheDocument();
    expect(screen.getByText("Don gia phai la so khong am.")).toBeInTheDocument();
  });

  it("allows customer unpaid invoice and posts to API", async () => {
    const fetchMock = mockSalesSession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/sales/invoices/new");

    await screen.findByRole("heading", { name: "Tao hoa don" });
    await testUser.click(await screen.findByLabelText("Khach hang"));
    await testUser.selectOptions(await screen.findByLabelText("Chon khach hang"), "21");
    await testUser.selectOptions(screen.getByLabelText("Hang hoa"), "10");
    await testUser.clear(screen.getByLabelText("Da thanh toan"));
    await testUser.type(screen.getByLabelText("Da thanh toan"), "0");
    await testUser.click(screen.getByRole("button", { name: "Tao hoa don" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/sales/invoices") && call[1]?.method === "POST")).toBe(true);
    });
    const createCall = fetchMock.mock.calls.find((call) => String(call[0]).endsWith("/sales/invoices") && call[1]?.method === "POST");
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      customer_id: 21,
      customer_snapshot_name: null,
      paid_amount: "0",
      payment_method: null,
      note: null,
      items: [{ product_id: 10, unit_type: "BAO", quantity: "1", unit_price: "250000.00" }],
    });
  });

  it("creates invoice and redirects to detail", async () => {
    const fetchMock = mockSalesSession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/sales/invoices/new");

    await screen.findByRole("heading", { name: "Tao hoa don" });
    await testUser.selectOptions(await screen.findByLabelText("Hang hoa"), "10");
    await testUser.clear(screen.getByLabelText("Da thanh toan"));
    await testUser.type(screen.getByLabelText("Da thanh toan"), "250000");
    await testUser.click(screen.getByRole("button", { name: "Tao hoa don" }));

    expect(await screen.findByRole("heading", { name: "Chi tiet hoa don" })).toBeInTheDocument();
    expect(await screen.findByText("Da tao hoa don.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/sales/invoices") && call[1]?.method === "POST")).toBe(true);
  });

  it("displays backend validation error for invoice create", async () => {
    setRefreshToken("stored-refresh");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse(user("owner")));
        if (url.includes("/inventory/products")) return Promise.resolve(jsonResponse([productFixture()]));
        if (url.includes("/customers")) return Promise.resolve(jsonResponse([customerFixture()]));
        if (url.endsWith("/sales/invoices") && init?.method === "POST") {
          return Promise.resolve(jsonResponse({ error: { code: "validation_error", message: "Invalid invoice" } }, 422));
        }
        return Promise.resolve(jsonResponse([]));
      }),
    );
    const testUser = userEvent.setup();
    renderRoute("/sales/invoices/new");

    await screen.findByRole("heading", { name: "Tao hoa don" });
    await testUser.selectOptions(await screen.findByLabelText("Hang hoa"), "10");
    await testUser.clear(screen.getByLabelText("Da thanh toan"));
    await testUser.type(screen.getByLabelText("Da thanh toan"), "250000");
    await testUser.click(screen.getByRole("button", { name: "Tao hoa don" }));

    expect(await screen.findByText("Invalid invoice")).toBeInTheDocument();
  });

  it("renders invoice empty state", async () => {
    mockSalesSession("owner", []);
    renderRoute("/sales/invoices");

    expect(await screen.findByText("Chua co hoa don ban hang.")).toBeInTheDocument();
  });

  it("renders invoice API error", async () => {
    setRefreshToken("stored-refresh");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) {
          return Promise.resolve(jsonResponse(user("owner")));
        }
        if (url.endsWith("/sales/invoices")) {
          return Promise.resolve(jsonResponse({ error: { code: "boom", message: "Invoice API failed" } }, 500));
        }
        return Promise.resolve(jsonResponse({}));
      }),
    );
    renderRoute("/sales/invoices");

    expect(await screen.findByText("Invoice API failed")).toBeInTheDocument();
  });

  it("renders invoice detail header and items", async () => {
    mockSalesSession("read_only");
    renderRoute("/sales/invoices/51");

    expect(await screen.findByText("HD20260517-001")).toBeInTheDocument();
    expect(screen.getByText("Giao buoi sang")).toBeInTheDocument();
    expect(screen.getByText("CASH")).toBeInTheDocument();
    expect(screen.getByText("150.000")).toBeInTheDocument();
    expect(screen.getByText("GAO-01")).toBeInTheDocument();
    expect(screen.getByText("Gao Thom")).toBeInTheDocument();
    expect(screen.getByText("Bao")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cap nhat hoa don" })).not.toBeInTheDocument();
  });

  it("renders inactive historical invoice detail and edit selections", async () => {
    setRefreshToken("stored-refresh");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse(user("owner")));
        if (url.includes("/inventory/products")) return Promise.resolve(jsonResponse([productFixture()]));
        if (url.includes("/customers")) return Promise.resolve(jsonResponse([customerFixture()]));
        if (url.endsWith("/sales/invoices/51") && init?.method === "PATCH") {
          return Promise.resolve(jsonResponse(inactiveHistoricalInvoiceFixture()));
        }
        if (url.endsWith("/sales/invoices/51")) return Promise.resolve(jsonResponse(inactiveHistoricalInvoiceFixture()));
        return Promise.resolve(jsonResponse([]));
      }),
    );

    renderRoute("/sales/invoices/51");
    expect(await screen.findByText("Khach Ngung Dung")).toBeInTheDocument();
    expect(screen.getByText("Hang Ngung Dung")).toBeInTheDocument();

    cleanup();
    renderRoute("/sales/invoices/51/edit");
    expect(await screen.findByRole("option", { name: "Khach Ngung Dung" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /OLD-01 - Hang Ngung Dung/ })).toBeInTheDocument();
  });

  it("shows invoice edit and delete controls to owner but not read only", async () => {
    mockSalesSession("owner");
    renderRoute("/sales/invoices/51");

    expect(await screen.findByRole("link", { name: "Sua hoa don" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xoa hoa don" })).toBeInTheDocument();

    cleanup();
    mockSalesSession("read_only");
    renderRoute("/sales/invoices/51");

    await screen.findByText("HD20260517-001");
    expect(screen.queryByRole("link", { name: "Sua hoa don" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xoa hoa don" })).not.toBeInTheDocument();
  });

  it("lets owner access invoice edit route and preloads invoice", async () => {
    mockSalesSession("owner");
    renderRoute("/sales/invoices/51/edit");

    expect(await screen.findByRole("heading", { name: "Sua hoa don" })).toBeInTheDocument();
    expect(await screen.findByText("Dang sua hoa don: HD20260517-001")).toBeInTheDocument();
    expect(screen.getByDisplayValue("100000.00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Giao buoi sang")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1.000")).toBeInTheDocument();
  });

  it("denies read only access to invoice edit route", async () => {
    mockSalesSession("read_only");
    renderRoute("/sales/invoices/51/edit");

    expect(await screen.findByRole("heading", { name: "Khong co quyen truy cap" })).toBeInTheDocument();
  });

  it("edit validation rejects invalid quantity", async () => {
    mockSalesSession("owner");
    const testUser = userEvent.setup();
    renderRoute("/sales/invoices/51/edit");

    await screen.findByText("Dang sua hoa don: HD20260517-001");
    await testUser.clear(screen.getByLabelText("So luong"));
    await testUser.type(screen.getByLabelText("So luong"), "0");
    await testUser.click(screen.getByRole("button", { name: "Luu hoa don" }));

    expect(await screen.findByText("So luong phai lon hon 0.")).toBeInTheDocument();
  });

  it("successful edit calls PATCH and redirects to detail", async () => {
    const fetchMock = mockSalesSession("owner");
    const testUser = userEvent.setup();
    renderRoute("/sales/invoices/51/edit");

    await screen.findByText("Dang sua hoa don: HD20260517-001");
    await testUser.clear(screen.getByLabelText("Da thanh toan"));
    await testUser.type(screen.getByLabelText("Da thanh toan"), "250000");
    await testUser.click(screen.getByRole("button", { name: "Luu hoa don" }));

    expect(await screen.findByRole("heading", { name: "Chi tiet hoa don" })).toBeInTheDocument();
    expect(await screen.findByText("Da cap nhat hoa don.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/sales/invoices/51") && call[1]?.method === "PATCH")).toBe(true);
  });

  it("displays backend validation error for invoice edit", async () => {
    setRefreshToken("stored-refresh");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse(user("owner")));
        if (url.includes("/inventory/products")) return Promise.resolve(jsonResponse([productFixture()]));
        if (url.includes("/customers")) return Promise.resolve(jsonResponse([customerFixture()]));
        if (url.endsWith("/sales/invoices/51") && init?.method === "PATCH") {
          return Promise.resolve(jsonResponse({ error: { code: "validation_error", message: "Cannot edit invoice" } }, 422));
        }
        if (url.endsWith("/sales/invoices/51")) return Promise.resolve(jsonResponse(invoiceFixture()));
        return Promise.resolve(jsonResponse([]));
      }),
    );
    const testUser = userEvent.setup();
    renderRoute("/sales/invoices/51/edit");

    await screen.findByText("Dang sua hoa don: HD20260517-001");
    await testUser.click(screen.getByRole("button", { name: "Luu hoa don" }));

    expect(await screen.findByText("Cannot edit invoice")).toBeInTheDocument();
  });

  it("delete confirmation cancel does not call API", async () => {
    const fetchMock = mockSalesSession("owner");
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const testUser = userEvent.setup();
    renderRoute("/sales/invoices/51");

    await testUser.click(await screen.findByRole("button", { name: "Xoa hoa don" }));

    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/sales/invoices/51") && call[1]?.method === "DELETE")).toBe(false);
  });

  it("delete confirmation confirm calls DELETE and redirects to list", async () => {
    const fetchMock = mockSalesSession("owner");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const testUser = userEvent.setup();
    renderRoute("/sales/invoices/51");

    await testUser.click(await screen.findByRole("button", { name: "Xoa hoa don" }));

    expect(await screen.findByRole("heading", { name: "Ban hang" })).toBeInTheDocument();
    expect(await screen.findByText("Da xoa hoa don.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/sales/invoices/51") && call[1]?.method === "DELETE")).toBe(true);
  });

  it("displays backend delete error", async () => {
    setRefreshToken("stored-refresh");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse(user("owner")));
        if (url.endsWith("/sales/invoices/51") && init?.method === "DELETE") {
          return Promise.resolve(jsonResponse({ error: { code: "validation_error", message: "Cannot delete invoice" } }, 422));
        }
        if (url.endsWith("/sales/invoices/51")) return Promise.resolve(jsonResponse(invoiceFixture()));
        return Promise.resolve(jsonResponse([]));
      }),
    );
    const testUser = userEvent.setup();
    renderRoute("/sales/invoices/51");

    await testUser.click(await screen.findByRole("button", { name: "Xoa hoa don" }));

    expect(await screen.findByText("Cannot delete invoice")).toBeInTheDocument();
  });

  it("renders invoice detail error state", async () => {
    mockSalesSession("read_only");
    renderRoute("/sales/invoices/404");

    expect(await screen.findByText("Invoice not found")).toBeInTheDocument();
  });
});

describe("returns", () => {
  it("renders return loading state", async () => {
    setRefreshToken("stored-refresh");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) {
          return Promise.resolve(jsonResponse(user("owner")));
        }
        if (url.endsWith("/returns")) {
          return new Promise(() => undefined);
        }
        return Promise.resolve(jsonResponse({}));
      }),
    );
    renderRoute("/returns");

    expect(await screen.findByText("Dang tai danh sach phieu tra...")).toBeInTheDocument();
  });

  it("renders return list success state", async () => {
    mockReturnsSession("read_only");
    renderRoute("/returns");

    expect(await screen.findByText("TR20260517-001")).toBeInTheDocument();
    expect(screen.getByText("Cong ty Minh Anh")).toBeInTheDocument();
    expect(screen.getByText("50.000")).toBeInTheDocument();
    expect(screen.getByText("Tru cong no")).toBeInTheDocument();
    expect(screen.getByText("#51")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Xem" })).toHaveAttribute("href", "/returns/71");
    expect(screen.queryByRole("link", { name: "Tao phieu tra" })).not.toBeInTheDocument();
  });

  it("sends return search and date range to backend query", async () => {
    const fetchMock = mockReturnsSession("owner", [returnFixture()]);
    const testUser = userEvent.setup();
    renderRoute("/returns");

    await screen.findByText("TR20260517-001");
    await testUser.type(screen.getByLabelText("Tim phieu tra"), "Minh Anh");
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => {
          const url = String(call[0]);
          return url.includes("/returns?") && url.includes("search=Minh+Anh");
        }),
      ).toBe(true);
    });

    await testUser.clear(screen.getByLabelText("Tim phieu tra"));
    await testUser.type(screen.getByLabelText("Tu ngay"), "2026-01-01");
    await testUser.type(screen.getByLabelText("Den ngay"), "2026-12-31");
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => {
          const url = String(call[0]);
          return url.includes("/returns?")
            && url.includes("date_from=2026-01-01T00%3A00%3A00")
            && url.includes("date_to=2026-12-31T23%3A59%3A59");
        }),
      ).toBe(true);
    });
  });

  it("shows return no-results empty state for unmatched filters", async () => {
    setRefreshToken("stored-refresh");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse(user("owner")));
        if (url.includes("/returns?search=khong+co")) return Promise.resolve(jsonResponse([]));
        if (url.includes("/returns")) return Promise.resolve(jsonResponse([returnFixture()]));
        return Promise.resolve(jsonResponse([]));
      }),
    );
    const testUser = userEvent.setup();
    renderRoute("/returns");

    await screen.findByText("TR20260517-001");
    await testUser.type(screen.getByLabelText("Tim phieu tra"), "khong co");

    expect(await screen.findByText("Khong co phieu tra phu hop bo loc hien tai.")).toBeInTheDocument();
  });

  it("shows return row edit action to owner and hides it from read only", async () => {
    mockReturnsSession("owner");
    renderRoute("/returns");
    expect(await screen.findByRole("link", { name: "Sua" })).toHaveAttribute("href", "/returns/71/edit");

    cleanup();
    mockReturnsSession("read_only");
    renderRoute("/returns");
    expect(await screen.findByRole("link", { name: "Xem" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sua" })).not.toBeInTheDocument();
  });

  it("shows return create action to owner and admin but not read only", async () => {
    mockReturnsSession("owner", []);
    renderRoute("/returns");
    expect(await screen.findByRole("link", { name: "Tao phieu tra" })).toBeInTheDocument();

    cleanup();
    mockReturnsSession("admin", []);
    renderRoute("/returns");
    expect(await screen.findByRole("link", { name: "Tao phieu tra" })).toBeInTheDocument();

    cleanup();
    mockReturnsSession("read_only", []);
    renderRoute("/returns");
    await screen.findByRole("heading", { name: "Tra hang" });
    expect(screen.queryByRole("link", { name: "Tao phieu tra" })).not.toBeInTheDocument();
  });

  it("denies read only access to return create route", async () => {
    mockReturnsSession("read_only", []);
    renderRoute("/returns/new");

    expect(await screen.findByRole("heading", { name: "Khong co quyen truy cap" })).toBeInTheDocument();
  });

  it("creates quick walk-in return and redirects to detail", async () => {
    const fetchMock = mockReturnsSession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/returns/new");

    await screen.findByRole("heading", { name: "Tao phieu tra" });
    await testUser.selectOptions(await screen.findByLabelText("Hang hoa"), "10");
    await testUser.clear(screen.getByLabelText("So luong"));
    await testUser.type(screen.getByLabelText("So luong"), "2");
    await testUser.click(screen.getByRole("button", { name: "Tao phieu tra" }));

    expect(await screen.findByText("TR20260517-001")).toBeInTheDocument();
    expect(await screen.findByText("Da tao phieu tra.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/returns") && call[1]?.method === "POST")).toBe(true);
  });

  it("creates linked return", async () => {
    const fetchMock = mockReturnsSession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/returns/new");

    await screen.findByRole("heading", { name: "Tao phieu tra" });
    await testUser.click(await screen.findByLabelText("Tra theo hoa don"));
    await testUser.selectOptions(await screen.findByLabelText("Hoa don goc"), "51");
    await testUser.selectOptions(await screen.findByLabelText("Dong hoa don goc"), "61");
    await testUser.clear(screen.getByLabelText("So luong"));
    await testUser.type(screen.getByLabelText("So luong"), "1");
    await testUser.click(screen.getByRole("button", { name: "Tao phieu tra" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/returns") && call[1]?.method === "POST")).toBe(true);
    });
  });

  it("renders useful return form selector labels", async () => {
    mockReturnsSession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/returns/new");

    await screen.findByRole("heading", { name: "Tao phieu tra" });
    await testUser.click(await screen.findByLabelText("Tra theo hoa don"));
    expect(screen.getByRole("option", { name: /HD20260517-001 - Cong ty Minh Anh/ })).toBeInTheDocument();
    await testUser.selectOptions(await screen.findByLabelText("Hoa don goc"), "51");
    expect(screen.getByRole("option", { name: /GAO-01 - Gao Thom - Bao - 1.000/ })).toBeInTheDocument();

    await testUser.click(screen.getByLabelText("Tra nhanh"));
    expect(screen.getByRole("option", { name: /GAO-01 - Gao Thom/ })).toBeInTheDocument();
    await testUser.click(screen.getByLabelText("Khach hang"));
    expect(screen.getByRole("option", { name: /Cong ty Minh Anh - 0909000000/ })).toBeInTheDocument();
  });

  it("shows return line validation near missing fields and invalid quantity", async () => {
    mockReturnsSession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/returns/new");

    await screen.findByRole("heading", { name: "Tao phieu tra" });
    await testUser.clear(await screen.findByLabelText("So luong"));
    await testUser.type(screen.getByLabelText("So luong"), "0");
    await testUser.click(screen.getByRole("button", { name: "Tao phieu tra" }));

    expect(await screen.findByText("Can chon hang hoa.")).toBeInTheDocument();
    expect(screen.getByText("Can chon don vi.")).toBeInTheDocument();
    expect(screen.getByText("So luong phai lon hon 0.")).toBeInTheDocument();
  });

  it("updates return total estimate from line values", async () => {
    mockReturnsSession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/returns/new");

    await screen.findByRole("heading", { name: "Tao phieu tra" });
    await testUser.selectOptions(await screen.findByLabelText("Hang hoa"), "10");
    await testUser.clear(screen.getByLabelText("So luong"));
    await testUser.type(screen.getByLabelText("So luong"), "2");

    expect(screen.getByText("Tam tinh dong: 500.000")).toBeInTheDocument();
    expect(screen.getByText("Tong tam tinh: 500.000")).toBeInTheDocument();
  });

  it("rejects walk-in store credit return", async () => {
    mockReturnsSession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/returns/new");

    await screen.findByRole("heading", { name: "Tao phieu tra" });
    await testUser.selectOptions(await screen.findByLabelText("Cach xu ly"), "STORE_CREDIT");
    await testUser.selectOptions(await screen.findByLabelText("Hang hoa"), "10");
    await testUser.click(screen.getByRole("button", { name: "Tao phieu tra" }));

    expect(await screen.findByText("Phieu tra khach le chi duoc hoan tien ngay.")).toBeInTheDocument();
  });

  it("requires source invoice and source item for linked returns", async () => {
    mockReturnsSession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/returns/new");

    await screen.findByRole("heading", { name: "Tao phieu tra" });
    await testUser.click(await screen.findByLabelText("Tra theo hoa don"));
    await testUser.click(screen.getByRole("button", { name: "Tao phieu tra" }));

    expect(await screen.findByText("Can chon hoa don goc.")).toBeInTheDocument();
    expect(screen.getByText("Can chon dong hoa don goc.")).toBeInTheDocument();
  });

  it("renders return empty state", async () => {
    mockReturnsSession("owner", []);
    renderRoute("/returns");

    expect(await screen.findByText("Chua co phieu tra hang.")).toBeInTheDocument();
  });

  it("renders return API error", async () => {
    setRefreshToken("stored-refresh");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) {
          return Promise.resolve(jsonResponse(user("owner")));
        }
        if (url.endsWith("/returns")) {
          return Promise.resolve(jsonResponse({ error: { code: "boom", message: "Return API failed" } }, 500));
        }
        return Promise.resolve(jsonResponse({}));
      }),
    );
    renderRoute("/returns");

    expect(await screen.findByText("Return API failed")).toBeInTheDocument();
  });

  it("renders return detail header and items", async () => {
    mockReturnsSession("read_only");
    renderRoute("/returns/71");

    expect(await screen.findByText("TR20260517-001")).toBeInTheDocument();
    expect(screen.getByText("Tra mot phan")).toBeInTheDocument();
    expect(screen.getByText("Tra theo hoa don")).toBeInTheDocument();
    expect(screen.getByText("Tru cong no")).toBeInTheDocument();
    expect(screen.getByText("GAO-01")).toBeInTheDocument();
    expect(screen.getByText("Gao Thom")).toBeInTheDocument();
    expect(screen.getByText("Kg")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("#61")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sua phieu tra" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xoa phieu tra" })).not.toBeInTheDocument();
  });

  it("shows return edit and delete controls to owner but not read only", async () => {
    mockReturnsSession("owner");
    renderRoute("/returns/71");

    expect(await screen.findByRole("link", { name: "Sua phieu tra" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xoa phieu tra" })).toBeInTheDocument();

    cleanup();
    mockReturnsSession("read_only");
    renderRoute("/returns/71");

    await screen.findByText("TR20260517-001");
    expect(screen.queryByRole("link", { name: "Sua phieu tra" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xoa phieu tra" })).not.toBeInTheDocument();
  });

  it("denies read only access to return edit route", async () => {
    mockReturnsSession("read_only");
    renderRoute("/returns/71/edit");

    expect(await screen.findByRole("heading", { name: "Khong co quyen truy cap" })).toBeInTheDocument();
  });

  it("lets owner access return edit route and preloads return", async () => {
    mockReturnsSession("owner");
    renderRoute("/returns/71/edit");

    expect(await screen.findByRole("heading", { name: "Sua phieu tra" })).toBeInTheDocument();
    expect(await screen.findByText("Dang sua phieu tra: TR20260517-001")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Tra mot phan")).toBeInTheDocument();
    expect(screen.getByDisplayValue("5.000")).toBeInTheDocument();
  });

  it("renders inactive historical return detail and edit selections", async () => {
    setRefreshToken("stored-refresh");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse(user("owner")));
        if (url.includes("/inventory/products")) return Promise.resolve(jsonResponse([productFixture()]));
        if (url.includes("/customers")) return Promise.resolve(jsonResponse([customerFixture()]));
        if (url.endsWith("/sales/invoices")) return Promise.resolve(jsonResponse([]));
        if (url.endsWith("/returns/71") && init?.method === "PATCH") {
          return Promise.resolve(jsonResponse(inactiveHistoricalReturnFixture()));
        }
        if (url.endsWith("/returns/71")) return Promise.resolve(jsonResponse(inactiveHistoricalReturnFixture()));
        return Promise.resolve(jsonResponse([]));
      }),
    );

    renderRoute("/returns/71");
    expect(await screen.findByText("Khach Ngung Dung")).toBeInTheDocument();
    expect(screen.getByText("Hang Ngung Dung")).toBeInTheDocument();

    cleanup();
    renderRoute("/returns/71/edit");
    expect(await screen.findByRole("option", { name: /#51 - Khach Ngung Dung/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /OLD-01 - Hang Ngung Dung - Kg - 5.000 - 50.000/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /OLD-01 - Hang Ngung Dung \(BAO_KG; Kg: 10000.00\)/ })).toBeInTheDocument();
  });

  it("edits return and redirects to detail", async () => {
    const fetchMock = mockReturnsSession("owner");
    const testUser = userEvent.setup();
    renderRoute("/returns/71/edit");

    await screen.findByText("Dang sua phieu tra: TR20260517-001");
    await testUser.clear(screen.getByLabelText("Ghi chu"));
    await testUser.type(screen.getByLabelText("Ghi chu"), "Da cap nhat");
    await testUser.clear(screen.getByLabelText("So luong"));
    await testUser.type(screen.getByLabelText("So luong"), "1");
    await testUser.click(screen.getByRole("button", { name: "Luu phieu tra" }));

    expect(await screen.findByText("Da cap nhat phieu tra.")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/returns/71") && call[1]?.method === "PATCH")).toBe(true);
    });
  });

  it("displays backend validation error for return create", async () => {
    setRefreshToken("stored-refresh");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse(user("owner")));
        if (url.includes("/inventory/products")) return Promise.resolve(jsonResponse([productFixture()]));
        if (url.includes("/customers")) return Promise.resolve(jsonResponse([customerFixture()]));
        if (url.endsWith("/sales/invoices")) return Promise.resolve(jsonResponse([invoiceFixture()]));
        if (url.endsWith("/returns") && init?.method === "POST") {
          return Promise.resolve(jsonResponse({ error: { code: "validation_error", message: "Invalid return" } }, 422));
        }
        return Promise.resolve(jsonResponse([]));
      }),
    );
    const testUser = userEvent.setup();
    renderRoute("/returns/new");

    await screen.findByRole("heading", { name: "Tao phieu tra" });
    await testUser.selectOptions(await screen.findByLabelText("Hang hoa"), "10");
    await testUser.click(screen.getByRole("button", { name: "Tao phieu tra" }));

    expect(await screen.findByText("Invalid return")).toBeInTheDocument();
  });

  it("delete confirmation cancel does not call return API", async () => {
    const fetchMock = mockReturnsSession("owner");
    const testUser = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    renderRoute("/returns/71");

    await testUser.click(await screen.findByRole("button", { name: "Xoa phieu tra" }));

    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/returns/71") && call[1]?.method === "DELETE")).toBe(false);
  });

  it("delete confirmation confirm calls return DELETE and redirects to list", async () => {
    const fetchMock = mockReturnsSession("owner");
    const testUser = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    renderRoute("/returns/71");

    await testUser.click(await screen.findByRole("button", { name: "Xoa phieu tra" }));

    expect(await screen.findByRole("heading", { name: "Tra hang" })).toBeInTheDocument();
    expect(await screen.findByText("Da xoa phieu tra.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/returns/71") && call[1]?.method === "DELETE")).toBe(true);
  });

  it("displays backend delete error for return", async () => {
    setRefreshToken("stored-refresh");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse(user("owner")));
        if (url.endsWith("/returns/71") && init?.method === "DELETE") {
          return Promise.resolve(jsonResponse({ error: { code: "validation_error", message: "Cannot delete return" } }, 422));
        }
        if (url.endsWith("/returns/71")) return Promise.resolve(jsonResponse(returnFixture()));
        return Promise.resolve(jsonResponse([]));
      }),
    );
    const testUser = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    renderRoute("/returns/71");

    await testUser.click(await screen.findByRole("button", { name: "Xoa phieu tra" }));

    expect(await screen.findByText("Cannot delete return")).toBeInTheDocument();
  });

  it("renders return detail error state", async () => {
    mockReturnsSession("read_only");
    renderRoute("/returns/404");

    expect(await screen.findByText("Return not found")).toBeInTheDocument();
  });
});

describe("inventory products", () => {
  it("renders product loading state", async () => {
    setRefreshToken("stored-refresh");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) {
          return Promise.resolve(jsonResponse(user("owner")));
        }
        if (url.includes("/inventory/products")) {
          return new Promise(() => undefined);
        }
        return Promise.resolve(jsonResponse({}));
      }),
    );
    renderRoute("/inventory/products");

    expect(await screen.findByText("Dang tai danh sach hang hoa...")).toBeInTheDocument();
  });

  it("renders product rows", async () => {
    mockInventorySession("owner");
    renderRoute("/inventory/products");

    expect(await screen.findByText("GAO-01")).toBeInTheDocument();
    expect(screen.getByText("Gao Thom")).toBeInTheDocument();
    expect(screen.getByText(/BAO: 250000.00/)).toBeInTheDocument();
    expect(screen.getByText("BAO: 5.000 | KG: 125.000")).toBeInTheDocument();
  });

  it("links product rows to detail and sends include_inactive when toggled", async () => {
    const fetchMock = mockInventorySession("owner", [productFixture(), inactiveProductFixture()]);
    const testUser = userEvent.setup();
    renderRoute("/inventory/products");

    expect(await screen.findByRole("link", { name: "GAO-01" })).toHaveAttribute("href", "/inventory/products/10");
    await testUser.click(screen.getByLabelText("Hien hang ngung dung"));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("include_inactive=true"))).toBe(true);
    });
  });

  it("renders inventory empty state", async () => {
    mockInventorySession("owner", []);
    renderRoute("/inventory/products");

    expect(await screen.findByText("Chua co hang hoa phu hop.")).toBeInTheDocument();
  });

  it("renders inventory API error", async () => {
    setRefreshToken("stored-refresh");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) {
          return Promise.resolve(jsonResponse(user("owner")));
        }
        if (url.includes("/inventory/products")) {
          return Promise.resolve(jsonResponse({ error: { code: "boom", message: "Inventory unavailable" } }, 500));
        }
        return Promise.resolve(jsonResponse({}));
      }),
    );

    renderRoute("/inventory/products");

    expect(await screen.findByText("Inventory unavailable")).toBeInTheDocument();
  });

  it("shows create action to owner and admin but not read only", async () => {
    mockInventorySession("owner", []);
    renderRoute("/inventory/products");
    expect(await screen.findByRole("link", { name: "Tạo sản phẩm" })).toBeInTheDocument();

    cleanup();
    mockInventorySession("admin", []);
    renderRoute("/inventory/products");
    expect(await screen.findByRole("link", { name: "Tạo sản phẩm" })).toBeInTheDocument();

    cleanup();
    mockInventorySession("read_only", []);
    renderRoute("/inventory/products");
    await screen.findByRole("heading", { name: "Hang hoa" });
    expect(screen.queryByRole("link", { name: "Tạo sản phẩm" })).not.toBeInTheDocument();
  });

  it("denies read only access to product create route", async () => {
    mockInventorySession("read_only", []);
    renderRoute("/inventory/products/new");

    expect(await screen.findByRole("heading", { name: "Khong co quyen truy cap" })).toBeInTheDocument();
  });

  it("switches create form price fields by unit mode", async () => {
    mockInventorySession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/inventory/products/new");

    expect(await screen.findByRole("heading", { name: "Tạo sản phẩm" })).toBeInTheDocument();
    expect(screen.getByLabelText("Bat gia BAO")).toBeInTheDocument();
    expect(screen.queryByLabelText("Gia BICH")).not.toBeInTheDocument();

    await testUser.click(screen.getByLabelText("BICH"));

    expect(screen.getByLabelText("Gia BICH")).toBeInTheDocument();
    expect(screen.queryByLabelText("Bat gia BAO")).not.toBeInTheDocument();
  });

  it("validates BAO_KG requires one enabled positive price", async () => {
    mockInventorySession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/inventory/products/new");

    await screen.findByRole("heading", { name: "Tạo sản phẩm" });
    await testUser.click(screen.getByLabelText("Bat gia BAO"));
    await testUser.click(screen.getByRole("button", { name: "Tạo sản phẩm" }));

    expect(await screen.findByText("Can bat it nhat mot gia BAO hoac KG.")).toBeInTheDocument();
  });

  it("validates BICH only allows BICH price", async () => {
    mockInventorySession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/inventory/products/new");

    await screen.findByRole("heading", { name: "Tạo sản phẩm" });
    await testUser.click(screen.getByLabelText("BICH"));
    await testUser.click(screen.getByRole("button", { name: "Tạo sản phẩm" }));

    expect(await screen.findByText("Gia BICH phai lon hon 0.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Gia BAO")).not.toBeInTheDocument();
  });

  it("creates a product and redirects to product list", async () => {
    const fetchMock = mockInventorySession("owner", []);
    const testUser = userEvent.setup();
    renderRoute("/inventory/products/new");

    await screen.findByRole("heading", { name: "Tạo sản phẩm" });
    await testUser.type(screen.getByLabelText("Ma hang hoa"), "gao-02");
    await testUser.type(screen.getByLabelText("Ten hang hoa"), "Gao Moi");
    await testUser.type(screen.getByLabelText("Gia BAO"), "250000");
    await testUser.click(screen.getByRole("button", { name: "Tạo sản phẩm" }));

    expect(await screen.findByRole("heading", { name: "Hang hoa" })).toBeInTheDocument();
    const createCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/inventory/products") && call[1]?.method === "POST");
    expect(createCall).toBeTruthy();
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      product_code_base: "gao-02",
      product_name: "Gao Moi",
      unit_mode: "BAO_KG",
      prices: [
        { unit_type: "BAO", price: "250000", is_enabled: true },
        { unit_type: "KG", price: "0", is_enabled: false },
      ],
    });
  });

  it("displays duplicate product code conflict", async () => {
    setRefreshToken("stored-refresh");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) {
          return Promise.resolve(jsonResponse(user("owner")));
        }
        if (url.includes("/inventory/products") && init?.method === "POST") {
          return Promise.resolve(jsonResponse({ error: { code: "conflict", message: "Product code already exists." } }, 409));
        }
        return Promise.resolve(jsonResponse([]));
      }),
    );
    const testUser = userEvent.setup();
    renderRoute("/inventory/products/new");

    await screen.findByRole("heading", { name: "Tạo sản phẩm" });
    await testUser.type(screen.getByLabelText("Ma hang hoa"), "dup");
    await testUser.type(screen.getByLabelText("Ten hang hoa"), "Duplicate");
    await testUser.type(screen.getByLabelText("Gia BAO"), "1");
    await testUser.click(screen.getByRole("button", { name: "Tạo sản phẩm" }));

    expect(await screen.findByText("Product code already exists.")).toBeInTheDocument();
  });

  it("renders product detail with balance and prices", async () => {
    mockInventorySession("owner");
    renderRoute("/inventory/products/10");

    expect(await screen.findByRole("heading", { name: "Chi tiet hang hoa" })).toBeInTheDocument();
    expect(await screen.findByText("GAO-01")).toBeInTheDocument();
    expect(screen.getByText("BAO: 5.000 | KG: 125.000")).toBeInTheDocument();
    expect(screen.getByText("250000.00")).toBeInTheDocument();
    expect(screen.getByText("10000.00")).toBeInTheDocument();
    expect(screen.getByText("Dang dung")).toBeInTheDocument();
    expect(await screen.findByText("Lich su ton kho")).toBeInTheDocument();
    expect(screen.getAllByText("Dat ton thuc te").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ban hang").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tra hang").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Hoa don #51" })).toHaveAttribute("href", "/sales/invoices/51");
    expect(screen.getByRole("link", { name: "Phieu tra #71" })).toHaveAttribute("href", "/returns/71");
  });

  it("read only can view product detail but cannot edit delete or adjust stock", async () => {
    mockInventorySession("read_only");
    renderRoute("/inventory/products/10");

    expect(await screen.findByRole("heading", { name: "Chi tiet hang hoa" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sua hang hoa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xoa hang hoa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tang ton" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Giam ton" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dat ton thuc te" })).not.toBeInTheDocument();
  });

  it("owner and admin can access product edit page", async () => {
    mockInventorySession("owner");
    renderRoute("/inventory/products/10/edit");
    expect(await screen.findByRole("heading", { name: "Sua hang hoa" })).toBeInTheDocument();

    cleanup();
    mockInventorySession("admin");
    renderRoute("/inventory/products/10/edit");
    expect(await screen.findByRole("heading", { name: "Sua hang hoa" })).toBeInTheDocument();
  });

  it("denies read only access to product edit route", async () => {
    mockInventorySession("read_only");
    renderRoute("/inventory/products/10/edit");

    expect(await screen.findByRole("heading", { name: "Khong co quyen truy cap" })).toBeInTheDocument();
  });

  it("preloads product edit form data", async () => {
    mockInventorySession("owner");
    renderRoute("/inventory/products/10/edit");

    expect(await screen.findByDisplayValue("GAO-01")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Gao Thom")).toBeInTheDocument();
    expect(screen.getByDisplayValue("250000.00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10000.00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("BAO_KG")).toBeDisabled();
  });

  it("edits product prices and redirects to detail", async () => {
    const fetchMock = mockInventorySession("owner");
    const testUser = userEvent.setup();
    renderRoute("/inventory/products/10/edit");

    await screen.findByRole("heading", { name: "Sua hang hoa" });
    await screen.findByDisplayValue("Gao Thom");
    await testUser.clear(screen.getByLabelText("Ten hang hoa"));
    await testUser.type(screen.getByLabelText("Ten hang hoa"), "Gao Cap Nhat");
    await testUser.clear(screen.getByLabelText("Gia KG"));
    await testUser.type(screen.getByLabelText("Gia KG"), "12000");
    await testUser.click(screen.getByRole("button", { name: "Luu hang hoa" }));

    expect(await screen.findByRole("heading", { name: "Chi tiet hang hoa" })).toBeInTheDocument();
    const patchCall = fetchMock.mock.calls.find((call) => String(call[0]).endsWith("/inventory/products/10") && call[1]?.method === "PATCH");
    expect(patchCall).toBeTruthy();
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
      product_name: "Gao Cap Nhat",
      prices: [
        { unit_type: "BAO", price: "250000.00", is_enabled: true },
        { unit_type: "KG", price: "12000", is_enabled: true },
      ],
    });
  });

  it("delete confirmation cancel does not call product API", async () => {
    const fetchMock = mockInventorySession("owner");
    const testUser = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    renderRoute("/inventory/products/10");

    await testUser.click(await screen.findByRole("button", { name: "Xoa hang hoa" }));

    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/inventory/products/10") && call[1]?.method === "DELETE")).toBe(false);
  });

  it("delete confirmation success redirects to product list with result message", async () => {
    const fetchMock = mockInventorySession("owner");
    const testUser = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    renderRoute("/inventory/products/10");

    await testUser.click(await screen.findByRole("button", { name: "Xoa hang hoa" }));

    expect(await screen.findByRole("heading", { name: "Hang hoa" })).toBeInTheDocument();
    expect(await screen.findByText("Hang hoa da duoc ngung dung.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/inventory/products/10") && call[1]?.method === "DELETE")).toBe(true);
  });

  it("stock increase success refetches product balance", async () => {
    const fetchMock = mockInventorySession("owner");
    const testUser = userEvent.setup();
    renderRoute("/inventory/products/10");

    await screen.findByRole("heading", { name: "Chi tiet hang hoa" });
    await screen.findByRole("button", { name: "Tang ton" });
    await testUser.type(screen.getByLabelText("So luong"), "1");
    await testUser.type(screen.getByLabelText("Ly do"), "Nhap them");
    await testUser.click(screen.getByRole("button", { name: "Tang ton" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/inventory/products/10/stock/increase") && call[1]?.method === "POST"),
      ).toBe(true);
      expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/inventory/products/10")).length).toBeGreaterThan(1);
      expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/inventory/products/10/movements")).length).toBeGreaterThan(1);
    });
    expect(await screen.findByText("Da tang ton kho.")).toBeInTheDocument();
  });

  it("stock decrease success refetches product balance", async () => {
    const fetchMock = mockInventorySession("owner");
    const testUser = userEvent.setup();
    renderRoute("/inventory/products/10");

    await screen.findByRole("heading", { name: "Chi tiet hang hoa" });
    await screen.findByRole("button", { name: "Giam ton" });
    await testUser.type(screen.getByLabelText("So luong"), "1");
    await testUser.type(screen.getByLabelText("Ly do"), "Kiem kho");
    await testUser.click(screen.getByRole("button", { name: "Giam ton" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/inventory/products/10/stock/decrease") && call[1]?.method === "POST"),
      ).toBe(true);
      expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/inventory/products/10")).length).toBeGreaterThan(1);
      expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/inventory/products/10/movements")).length).toBeGreaterThan(1);
    });
    expect(await screen.findByText("Da giam ton kho.")).toBeInTheDocument();
  });

  it("stock set success refetches product balance", async () => {
    const fetchMock = mockInventorySession("owner");
    const testUser = userEvent.setup();
    renderRoute("/inventory/products/10");

    await screen.findByRole("heading", { name: "Chi tiet hang hoa" });
    await screen.findByRole("button", { name: "Dat ton thuc te" });
    await testUser.selectOptions(screen.getByLabelText("Don vi"), "KG");
    await testUser.type(screen.getByLabelText("So luong"), "25");
    await testUser.type(screen.getByLabelText("Ly do"), "Kiem kho thuc te");
    await testUser.click(screen.getByRole("button", { name: "Dat ton thuc te" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/inventory/products/10/stock/set") && call[1]?.method === "POST")).toBe(true);
      expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/inventory/products/10")).length).toBeGreaterThan(1);
      expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/inventory/products/10/movements")).length).toBeGreaterThan(1);
    });
    const setCall = fetchMock.mock.calls.find((call) => String(call[0]).endsWith("/inventory/products/10/stock/set") && call[1]?.method === "POST");
    expect(JSON.parse(String(setCall?.[1]?.body))).toEqual({
      unit_type: "KG",
      target_quantity: "25",
      note: "Kiem kho thuc te",
    });
    expect(await screen.findByText("Da dat ton thuc te.")).toBeInTheDocument();
  });

  it("filters inventory movements by type and date", async () => {
    mockInventorySession("owner");
    const testUser = userEvent.setup();
    renderRoute("/inventory/products/10");

    await screen.findByText("Lich su ton kho");
    await testUser.selectOptions(screen.getByLabelText("Loai phat sinh"), "SALE");
    expect(screen.getByRole("link", { name: "Hoa don #51" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Phieu tra #71" })).not.toBeInTheDocument();

    await testUser.selectOptions(screen.getByLabelText("Loai phat sinh"), "");
    await testUser.type(screen.getByLabelText("Tu ngay"), "2026-05-18");
    expect(await screen.findByText("Khong co phat sinh phu hop bo loc.")).toBeInTheDocument();
  });

  it("displays product mutation API errors", async () => {
    setRefreshToken("stored-refresh");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return Promise.resolve(
            jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
          );
        }
        if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse(user("owner")));
        if (url.endsWith("/inventory/products/10/stock/increase") && init?.method === "POST") {
          return Promise.resolve(jsonResponse({ error: { code: "validation_error", message: "Stock adjustment failed" } }, 422));
        }
        if (url.endsWith("/inventory/products/10/movements")) return Promise.resolve(jsonResponse(inventoryMovementFixture()));
        if (url.endsWith("/inventory/products/10")) return Promise.resolve(jsonResponse(productFixture()));
        return Promise.resolve(jsonResponse([]));
      }),
    );
    const testUser = userEvent.setup();
    renderRoute("/inventory/products/10");

    await screen.findByRole("heading", { name: "Chi tiet hang hoa" });
    await screen.findByRole("button", { name: "Tang ton" });
    await testUser.type(screen.getByLabelText("So luong"), "1");
    await testUser.type(screen.getByLabelText("Ly do"), "Nhap them");
    await testUser.click(screen.getByRole("button", { name: "Tang ton" }));

    expect(await screen.findByText("Stock adjustment failed")).toBeInTheDocument();
  });
});

describe("auth flow", () => {
  it("renders login page", async () => {
    renderRoute("/login");

    expect(await screen.findByRole("heading", { name: "Dang nhap" })).toBeInTheDocument();
    expect(screen.getByLabelText("Ten dang nhap")).toBeInTheDocument();
    expect(screen.getByLabelText("Mat khau")).toBeInTheDocument();
  });

  it("builds auth login URL under the configured API base without malformed slashes", () => {
    expect(normalizeApiBaseUrl(" http://localhost:8000/api/ ")).toBe("http://localhost:8000/api");
    expect(normalizeApiBaseUrl("")).toBe("http://127.0.0.1:8000/api");
    expect(parseBooleanFlag("true")).toBe(true);
    expect(parseBooleanFlag("false")).toBe(false);
    expect(buildApiUrl("/auth/login")).toBe("http://127.0.0.1:8000/api/auth/login");
  });

  it("opens the admin shell directly when local auth bypass is enabled", async () => {
    window.sessionStorage.setItem("qlhh.authBypass", "true");
    renderRoute("/");

    expect(await screen.findByRole("heading", { name: "Tong quan" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nguoi dung hien tai")).toHaveTextContent("Local Admin");
    expect(screen.getByLabelText("Nguoi dung hien tai")).toHaveTextContent("owner");
  });

  it("treats local auth bypass user as owner for role-gated screens", async () => {
    window.sessionStorage.setItem("qlhh.authBypass", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/inventory/products")) {
          return Promise.resolve(jsonResponse([productFixture()]));
        }
        return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404));
      }),
    );

    renderRoute("/inventory/products");

    expect(await screen.findByRole("link", { name: "Tạo sản phẩm" })).toBeInTheDocument();
  });

  it("login request uses the API base URL and sends the backend JSON schema", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return Promise.resolve(
        jsonResponse({
          access_token: "access",
          refresh_token: "refresh",
          token_type: "bearer",
          expires_in: 1800,
          user: user("owner"),
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await loginRequest("admin", "ChangeMe12345!");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:8000/api/auth/login");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({ username: "admin", password: "ChangeMe12345!" });
  });

  it("successful login redirects to the app", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/login")) {
        return Promise.resolve(
          jsonResponse({
            access_token: "access",
            refresh_token: "refresh",
            token_type: "bearer",
            expires_in: 1800,
            user: user("owner"),
          }),
        );
      }
      return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404));
    });
    vi.stubGlobal("fetch", fetchMock);
    const testUser = userEvent.setup();
    renderRoute("/login");

    await testUser.type(screen.getByLabelText("Ten dang nhap"), "admin");
    await testUser.type(screen.getByLabelText("Mat khau"), "strong-password");
    await testUser.click(screen.getByRole("button", { name: "Dang nhap" }));

    expect(await screen.findByRole("heading", { name: "Tong quan" })).toBeInTheDocument();
    expect(window.sessionStorage.getItem("qlhh.refreshToken")).toBe("refresh");
  });

  it("displays backend login error clearly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/auth/login")) {
          return Promise.resolve(jsonResponse({ error: { code: "authentication_error", message: "Invalid username or password" } }, 401));
        }
        return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404));
      }),
    );
    const testUser = userEvent.setup();
    renderRoute("/login");

    await testUser.type(screen.getByLabelText("Ten dang nhap"), "admin");
    await testUser.type(screen.getByLabelText("Mat khau"), "bad-password");
    await testUser.click(screen.getByRole("button", { name: "Dang nhap" }));

    expect(await screen.findByText("Invalid username or password")).toBeInTheDocument();
  });

  it("logout clears the stored session", async () => {
    mockAuthenticatedSession("owner");
    const testUser = userEvent.setup();
    renderRoute("/");

    await screen.findByRole("heading", { name: "Tong quan" });
    await testUser.click(screen.getByRole("button", { name: "Dang xuat" }));

    await waitFor(() => expect(window.sessionStorage.getItem("qlhh.refreshToken")).toBeNull());
    expect(await screen.findByRole("heading", { name: "Dang nhap" })).toBeInTheDocument();
  });

  it("restores a session with refresh token flow", async () => {
    const fetchMock = mockAuthenticatedSession("admin");
    renderRoute("/");

    expect(await screen.findByRole("heading", { name: "Tong quan" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/refresh"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(window.sessionStorage.getItem("qlhh.refreshToken")).toBe("new-refresh");
  });

  it("parses backend API error shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(jsonResponse({ error: { code: "validation_error", message: "Bad input" } }, 422)),
      ),
    );

    await expect(apiRequest("/example", { skipAuth: true, skipRefresh: true })).rejects.toEqual(
      new ApiError(422, "validation_error", "Bad input"),
    );
  });

  it("reports HTTP 500 as a backend error instead of a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("Internal Server Error", { status: 500 }))));

    await expect(apiRequest("/reports/dashboard-summary", { skipAuth: true, skipRefresh: true })).rejects.toEqual(
      new ApiError(500, "http_error", "Backend tra ve loi HTTP 500."),
    );
  });

  it("reports network and CORS-style fetch failures with the resolved API base", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));

    await expect(apiRequest("/inventory/products", { skipAuth: true, skipRefresh: true })).rejects.toEqual(
      new ApiError(
        0,
        "network_error",
        "Khong the ket noi API tai http://127.0.0.1:8000/api. Kiem tra backend, CORS va VITE_API_BASE_URL.",
      ),
    );
  });

  it("reports backend bypass mismatch clearly when frontend bypass receives 401", async () => {
    window.sessionStorage.setItem("qlhh.authBypass", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse({ error: { code: "authentication_error", message: "Missing bearer token." } }, 401))),
    );

    await expect(apiRequest("/inventory/products")).rejects.toEqual(
      new ApiError(
        401,
        "authentication_error",
        "Missing bearer token. Frontend dang bat local auth bypass; hay chay backend voi APP_ENV=local va AUTH_BYPASS=true.",
      ),
    );
  });

  it("refreshes once after a protected request returns 401", async () => {
    setRefreshToken("stored-refresh");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: "authentication_error", message: "Expired" } }, 401))
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: "refreshed-access",
          refresh_token: "rotated-refresh",
          token_type: "bearer",
          expires_in: 1800,
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest<{ status: string }>("/protected")).resolves.toEqual({ status: "ok" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1][0])).toContain("/auth/refresh");
    expect(window.sessionStorage.getItem("qlhh.refreshToken")).toBe("rotated-refresh");
  });
});
