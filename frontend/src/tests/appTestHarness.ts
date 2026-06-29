import { vi } from "vitest";

import { setRefreshToken } from "../auth/tokenStore";
import type { UserRole } from "../domain/roles";

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function user(role: UserRole = "owner") {
  return {
    id: 1,
    username: `${role}_user`,
    display_name: `${role} user`,
    role,
    is_active: true,
  };
}

export function dashboardSummaryFixture() {
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

export function dashboardOverviewFixture() {
  return {
    today_invoice_count: 2,
    today_sales_total: "250000.00",
    today_return_count: 1,
    today_return_total: "50000.00",
    this_month_sales_total: "1250000.00",
    last_month_sales_total: "980000.00",
    last_7_days_sales_total: "410000.00",
    current_customer_debt: "85000.00",
    positive_debt_customer_count: 1,
  };
}

export function customerDebtReportFixture() {
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

export function inventorySummaryReportFixture() {
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

export function salesSummaryReportFixture() {
  return {
    total_sales: "250000.00",
    total_paid: "150000.00",
    invoice_count: 1,
    average_invoice_total: "250000.00",
    by_day: [{ date: "2026-05-17", invoice_count: 1, total_sales: "250000.00", total_paid: "150000.00" }],
  };
}

export function salesTimeseriesFixture(period = "today", granularity = "hour") {
  return {
    period,
    granularity,
    buckets:
      granularity === "hour"
        ? [
            { label: "08:00", start_datetime: "2026-05-17T08:00:00Z", end_datetime: "2026-05-17T09:00:00Z", sales_total: "0", invoice_count: 0 },
            { label: "09:00", start_datetime: "2026-05-17T09:00:00Z", end_datetime: "2026-05-17T10:00:00Z", sales_total: "250000.00", invoice_count: 1 },
            { label: "10:00", start_datetime: "2026-05-17T10:00:00Z", end_datetime: "2026-05-17T11:00:00Z", sales_total: "50000.00", invoice_count: 1 },
          ]
        : [
            { label: "2026-05-11", start_datetime: "2026-05-11T00:00:00Z", end_datetime: "2026-05-12T00:00:00Z", sales_total: "0", invoice_count: 0 },
            { label: "2026-05-12", start_datetime: "2026-05-12T00:00:00Z", end_datetime: "2026-05-13T00:00:00Z", sales_total: "120000.00", invoice_count: 1 },
            { label: "2026-05-13", start_datetime: "2026-05-13T00:00:00Z", end_datetime: "2026-05-14T00:00:00Z", sales_total: "0", invoice_count: 0 },
            { label: "2026-05-14", start_datetime: "2026-05-14T00:00:00Z", end_datetime: "2026-05-15T00:00:00Z", sales_total: "80000.00", invoice_count: 1 },
            { label: "2026-05-15", start_datetime: "2026-05-15T00:00:00Z", end_datetime: "2026-05-16T00:00:00Z", sales_total: "0", invoice_count: 0 },
            { label: "2026-05-16", start_datetime: "2026-05-16T00:00:00Z", end_datetime: "2026-05-17T00:00:00Z", sales_total: "110000.00", invoice_count: 1 },
            { label: "2026-05-17", start_datetime: "2026-05-17T00:00:00Z", end_datetime: "2026-05-18T00:00:00Z", sales_total: "100000.00", invoice_count: 1 },
          ],
  };
}

export function returnsSummaryReportFixture() {
  return {
    total_returns: "50000.00",
    return_count: 1,
    by_day: [{ date: "2026-05-17", return_count: 1, total_returns: "50000.00" }],
  };
}

export function historyListFixture() {
  return {
    page: 1,
    page_size: 8,
    total: 3,
    items: [
      {
        event_type: "SALES_INVOICE",
        event_id: 51,
        event_datetime: "2026-05-17T09:00:00Z",
        display_order: 0,
        code: "HD20260517-001",
        customer_id: 21,
        customer_name: "Cong ty Minh Anh",
        product_id: null,
        product_name: null,
        amount: "250000.00",
        paid_amount: "100000.00",
        item_count: 1,
        quantity: null,
        unit_type: null,
        status: "COMPLETED",
        source_type: "invoice",
        source_id: 51,
        note: "Giao buoi sang",
        open_target: { target_type: "invoice", target_id: 51, route: "/sales/invoices/51" },
      },
      {
        event_type: "STOCK_MOVEMENT",
        event_id: 81,
        event_datetime: "2026-05-17T10:00:00Z",
        display_order: 0,
        code: null,
        customer_id: null,
        customer_name: null,
        product_id: 10,
        product_name: "Gao Thom",
        amount: null,
        paid_amount: null,
        item_count: null,
        quantity: "-1.000",
        unit_type: "BAO",
        status: "SALE",
        source_type: "invoice",
        source_id: 51,
        note: "Xuat kho",
        open_target: { target_type: "product", target_id: 10, route: "/inventory/products/10" },
      },
      {
        event_type: "ORDER",
        event_id: 61,
        event_datetime: "2026-05-17T11:00:00Z",
        display_order: 0,
        code: "DH20260517-001",
        customer_id: 21,
        customer_name: "Cong ty Minh Anh",
        product_id: null,
        product_name: null,
        amount: null,
        paid_amount: null,
        item_count: 1,
        quantity: "2.000",
        unit_type: "BAO",
        status: "OPEN",
        source_type: "order",
        source_id: 61,
        note: "Cho xu ly",
        open_target: { target_type: "order", target_id: 61, route: "/orders/61" },
      },
    ],
  };
}

export function productFixture() {
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

export function bichProductFixture() {
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

export function inactiveProductFixture() {
  return {
    ...productFixture(),
    id: 12,
    product_code_base: "OLD-01",
    product_name: "Hang Ngung Dung",
    is_active: false,
  };
}

export function inventoryMovementFixture() {
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
  ];
}

export function customerFixture() {
  return {
    id: 21,
    customer_name: "Cong ty Minh Anh",
    phone: "0909000000",
    address: "Ha Noi",
    note: "Khách hàng thân thiết",
    current_balance: "100000.00",
    total_sales: "500000.00",
    is_walk_in: false,
    is_active: true,
    created_at: "2026-05-17T00:00:00Z",
    updated_at: "2026-05-17T00:00:00Z",
  };
}

export function ledgerFixture() {
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

export function debtPaymentFixture() {
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

export function invoiceFixture() {
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

export function returnFixture() {
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

export function mockAuthenticatedSession(role: UserRole = "owner") {
  setRefreshToken("stored-refresh");
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/auth/refresh")) {
      return Promise.resolve(jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }));
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
    if (url.endsWith("/reports/overview")) {
      return Promise.resolve(jsonResponse(dashboardOverviewFixture()));
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
    if (url.includes("/reports/sales-timeseries")) {
      const parsedUrl = new URL(url);
      const period = parsedUrl.searchParams.get("period") ?? "today";
      const granularity = parsedUrl.searchParams.get("granularity") ?? "hour";
      return Promise.resolve(jsonResponse(salesTimeseriesFixture(period, granularity)));
    }
    if (url.includes("/history")) {
      return Promise.resolve(jsonResponse(historyListFixture()));
    }
    if (url.includes("/reports/returns-summary")) {
      return Promise.resolve(jsonResponse(returnsSummaryReportFixture()));
    }
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function mockInventorySession(role: UserRole, products: unknown[] = [productFixture()]) {
  setRefreshToken("stored-refresh");
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/auth/refresh")) return Promise.resolve(jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }));
    if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse(user(role)));
    if (url.endsWith("/inventory/products/10/movements")) return Promise.resolve(jsonResponse(inventoryMovementFixture()));
    if (url.endsWith("/inventory/products/10/stock/increase") && init?.method === "POST") return Promise.resolve(jsonResponse({ product_id: 10, on_hand_bao_decimal: "6.000", on_hand_bich_integer: null, derived_kg_balance: "150.000", updated_at: "2026-05-17T01:00:00Z" }));
    if (url.endsWith("/inventory/products/10/stock/decrease") && init?.method === "POST") return Promise.resolve(jsonResponse({ product_id: 10, on_hand_bao_decimal: "4.000", on_hand_bich_integer: null, derived_kg_balance: "100.000", updated_at: "2026-05-17T01:00:00Z" }));
    if (url.endsWith("/inventory/products/10/stock/set") && init?.method === "POST") return Promise.resolve(jsonResponse({ product_id: 10, on_hand_bao_decimal: "1.000", on_hand_bich_integer: null, derived_kg_balance: "25.000", updated_at: "2026-05-17T01:00:00Z" }));
    if (url.endsWith("/inventory/products/10") && init?.method === "PATCH") return Promise.resolve(jsonResponse({ ...productFixture(), product_name: "Gao Cap Nhat" }));
    if (url.endsWith("/inventory/products/10") && init?.method === "DELETE") return Promise.resolve(jsonResponse({ product_id: 10, action: "deactivated" }));
    if (url.includes("/inventory/products") && init?.method === "POST") return Promise.resolve(jsonResponse(productFixture(), 201));
    if (url.endsWith("/inventory/products/10")) return Promise.resolve(jsonResponse(productFixture()));
    if (url.endsWith("/inventory/products/12")) return Promise.resolve(jsonResponse(inactiveProductFixture()));
    if (url.includes("/inventory/products")) return Promise.resolve(jsonResponse(products));
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function mockCustomerSession(
  role: UserRole,
  customers: unknown[] = [customerFixture()],
  ledger: unknown[] = ledgerFixture(),
  debtPayments: unknown[] = [debtPaymentFixture()],
  invoices: unknown[] = [invoiceFixture()],
  returns: unknown[] = [returnFixture()],
) {
  setRefreshToken("stored-refresh");
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/auth/refresh")) return Promise.resolve(jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }));
    if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse(user(role)));
    if (url.endsWith("/customers/21/balance-adjustments") && init?.method === "POST") return Promise.resolve(jsonResponse({ customer: { ...customerFixture(), current_balance: "125000.00" }, ledger: { ...ledgerFixture()[0], id: 32, event_type: "BALANCE_ADJUSTMENT", ref_type: "BALANCE_ADJUSTMENT", amount_delta: "25000.00", balance_after: "125000.00", note: "manual correction" } }, 201));
    if (url.endsWith("/customers/21/ledger")) return Promise.resolve(jsonResponse(ledger));
    if (url.endsWith("/customers/21/debt-payments/41") && init?.method === "PATCH") return Promise.resolve(jsonResponse({ payment: { ...debtPaymentFixture(), amount: "30000.00" }, ledger: null, current_balance: "70000.00" }));
    if (url.endsWith("/customers/21/debt-payments/41") && init?.method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }));
    if (url.endsWith("/customers/21/debt-payments") && init?.method === "POST") return Promise.resolve(jsonResponse({ payment: debtPaymentFixture(), ledger: null, current_balance: "75000.00" }, 201));
    if (url.endsWith("/customers/21/debt-payments")) return Promise.resolve(jsonResponse(debtPayments));
    if (url.endsWith("/customers/21") && init?.method === "PATCH") return Promise.resolve(jsonResponse({ ...customerFixture(), customer_name: "Cong ty Cap Nhat", phone: "0911" }));
    if (url.endsWith("/customers/21") && init?.method === "DELETE") return Promise.resolve(jsonResponse({ customer_id: 21, action: "deactivated" }));
    if (url.endsWith("/customers/404")) return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Customer not found" } }, 404));
    if (url.endsWith("/customers/21")) return Promise.resolve(jsonResponse(customerFixture()));
    if (url.endsWith("/sales/invoices/51")) return Promise.resolve(jsonResponse(invoiceFixture()));
    if (url.includes("/sales/invoices?") || url.endsWith("/sales/invoices")) return Promise.resolve(jsonResponse(invoices));
    if (url.endsWith("/returns/71")) return Promise.resolve(jsonResponse(returnFixture()));
    if (url.includes("/returns?") || url.endsWith("/returns")) return Promise.resolve(jsonResponse(returns));
    if (url.includes("/customers") && init?.method === "POST") return Promise.resolve(jsonResponse(customerFixture(), 201));
    if (url.includes("/customers")) return Promise.resolve(jsonResponse(customers));
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function mockSalesSession(role: UserRole, invoices: unknown[] = [invoiceFixture()]) {
  setRefreshToken("stored-refresh");
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/auth/refresh")) return Promise.resolve(jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }));
    if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse(user(role)));
    if (url.includes("/inventory/products")) return Promise.resolve(jsonResponse([productFixture(), bichProductFixture()]));
    if (url.includes("/customers")) return Promise.resolve(jsonResponse([customerFixture()]));
    if (url.endsWith("/sales/invoices/51") && init?.method === "PATCH") return Promise.resolve(jsonResponse({ ...invoiceFixture(), paid_amount: "250000.00" }));
    if (url.endsWith("/sales/invoices/51") && init?.method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }));
    if (url.endsWith("/sales/invoices") && init?.method === "POST") return Promise.resolve(jsonResponse(invoiceFixture(), 201));
    if (url.endsWith("/sales/invoices/404")) return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Invoice not found" } }, 404));
    if (url.endsWith("/sales/invoices/51")) return Promise.resolve(jsonResponse(invoiceFixture()));
    if (url.includes("/sales/invoices?") || url.endsWith("/sales/invoices")) return Promise.resolve(jsonResponse(invoices));
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function mockReturnsSession(role: UserRole, returns: unknown[] = [returnFixture()]) {
  setRefreshToken("stored-refresh");
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/auth/refresh")) return Promise.resolve(jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }));
    if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse(user(role)));
    if (url.includes("/inventory/products")) return Promise.resolve(jsonResponse([productFixture(), bichProductFixture()]));
    if (url.includes("/customers")) return Promise.resolve(jsonResponse([customerFixture()]));
    if (url.endsWith("/sales/invoices/51")) return Promise.resolve(jsonResponse(invoiceFixture()));
    if (url.endsWith("/sales/invoices")) return Promise.resolve(jsonResponse([invoiceFixture()]));
    if (url.endsWith("/returns/71") && init?.method === "PATCH") return Promise.resolve(jsonResponse({ ...returnFixture(), note: "Da cap nhat" }));
    if (url.endsWith("/returns/71") && init?.method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }));
    if (url.endsWith("/returns") && init?.method === "POST") return Promise.resolve(jsonResponse(returnFixture(), 201));
    if (url.endsWith("/returns/404")) return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Return not found" } }, 404));
    if (url.endsWith("/returns/71")) return Promise.resolve(jsonResponse(returnFixture()));
    if (url.includes("/returns?") || url.endsWith("/returns")) return Promise.resolve(jsonResponse(returns));
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function mockOrderSession(role: UserRole, orders: unknown[] = [{ id: 61, order_code: "DH20260521-001", customer_id: 21, customer_name_snapshot: "Cong ty Minh Anh", order_datetime: "2026-05-21T09:00:00Z", required_delivery_datetime: null, note: "Can giao som", status: "OPEN", source_invoice_id: null, completed_at: null, created_at: "2026-05-21T09:00:00Z", updated_at: "2026-05-21T09:00:00Z", items: [{ id: 71, product_id: 10, product_name_snapshot: "Gao Thom", unit_type: "BAO", quantity: "2.000", created_at: "2026-05-21T09:00:00Z" }] }], summary: unknown[] = [{ product_id: 10, product_name: "Gao Thom", unit_type: "BAO", quantity: "2.000", stock_available: "5.000" }]) {
  setRefreshToken("stored-refresh");
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/auth/refresh")) return Promise.resolve(jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }));
    if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse(user(role)));
    if (url.includes("/inventory/products")) return Promise.resolve(jsonResponse([productFixture()]));
    if (url.endsWith("/orders/quantity-summary")) return Promise.resolve(jsonResponse(summary));
    if (url.endsWith("/orders")) return Promise.resolve(jsonResponse(orders));
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function mockAttendanceBlowDefaultsSession(
  role: UserRole,
  options?: { noWorkTypesInitially?: boolean; lockedDates?: string[]; forceSaveErrorMessage?: string | null },
) {
  setRefreshToken("stored-refresh");
  const defaults = [
    { id: 1, name: "Thừa máy", team: "blow", input_type: "quantity", pricing_rule: "quantity_excess_over_quota", quota_quantity: "3", unit_price: "80000", exclusive_group: null, is_active: true, legacy_work_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
    { id: 2, name: "Máy nhỏ", team: "blow", input_type: "quantity", pricing_rule: "quantity_full", quota_quantity: null, unit_price: "30000", exclusive_group: null, is_active: true, legacy_work_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
    { id: 3, name: "Máy to", team: "blow", input_type: "quantity", pricing_rule: "quantity_full", quota_quantity: null, unit_price: "40000", exclusive_group: null, is_active: true, legacy_work_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
    { id: 4, name: "Phụ cắt", team: "blow", input_type: "quantity", pricing_rule: "quantity_full", quota_quantity: null, unit_price: "50000", exclusive_group: null, is_active: true, legacy_work_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
    { id: 5, name: "Phụ găng 1 máy", team: "blow", input_type: "tick", pricing_rule: "flat_tick", quota_quantity: null, unit_price: "30000", exclusive_group: "glove", is_active: true, legacy_work_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
    { id: 6, name: "Phụ găng 2 máy", team: "blow", input_type: "tick", pricing_rule: "flat_tick", quota_quantity: null, unit_price: "50000", exclusive_group: "glove", is_active: true, legacy_work_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
  ];
  let workTypes = options?.noWorkTypesInitially ? [] : [...defaults];
  let employees = [
    { id: 1, display_name: "Blow A", team: "blow", is_active: true, user_id: null, legacy_employee_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
    { id: 2, display_name: "Cut B", team: "cut", is_active: true, user_id: null, legacy_employee_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
    { id: 3, display_name: "Inactive C", team: "cut", is_active: false, user_id: null, legacy_employee_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
  ];
  let nextEmployeeId = 4;
  let nextRecordId = 10;
  const bagTypes = [
    { id: 11, name: "Bao 25kg", product_id: null, source_product_name_snapshot: null, quota_quantity: "25.00", excess_unit_price: "3500", is_active: true, is_product_linked: true, is_excluded_from_attendance: false, is_legacy: false, legacy_bag_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
    { id: 12, name: "Bao 50kg", product_id: null, source_product_name_snapshot: null, quota_quantity: "30.00", excess_unit_price: "4200", is_active: true, is_product_linked: true, is_excluded_from_attendance: false, is_legacy: false, legacy_bag_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
  ];
  type StoredRecord = {
    record_id: number;
    employee_id: number;
    selected_date: string;
    status: "draft" | "done";
    is_absent: boolean;
    total_amount_snapshot: string;
    blow_work: { work_type_id: number; quantity: string | null }[];
    cut_work: { bag_type_id: number; quantity: string }[];
    extra_cut_work: { bag_type_id: number; quantity: string }[];
  };
  const records = new Map<string, StoredRecord>();
  const key = (employeeId: number, selectedDate: string) => `${employeeId}:${selectedDate}`;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.endsWith("/auth/refresh")) return jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 });
    if (url.endsWith("/auth/me")) return jsonResponse(user(role));
    if (url.endsWith("/auth/logout")) return jsonResponse({ status: "ok" });
    if (url.endsWith("/attendance/reference")) return jsonResponse({ teams: ["blow", "cut"], record_statuses: ["draft", "done"] });
    if (url.endsWith("/attendance/work-types/seed-defaults") && method === "POST") {
      const existing = new Set(workTypes.map((row) => row.name));
      const created = defaults.filter((row) => !existing.has(row.name));
      const skipped = defaults.filter((row) => existing.has(row.name));
      workTypes = [...workTypes, ...created];
      return jsonResponse({
        created_count: created.length,
        skipped_count: skipped.length,
        created_names: created.map((row) => row.name),
        skipped_names: skipped.map((row) => row.name),
      });
    }
    if (url.includes("/attendance/work-types")) return jsonResponse(workTypes);
    if (url.includes("/attendance/cut-work-items")) return jsonResponse(bagTypes);
    if (url.includes("/attendance/reports/period")) return jsonResponse({ team: "blow", period_id: 1, start_date: "2026-05-01", end_date: "2026-05-10", detail_labels: ["Máy nhỏ"], employee_summaries: [{ employee_id: 1, display_name: "Blow A", total_amount: "0", paid_workdays: 0 }], rows: [], grand_total: "0", total_paid_workdays: 0 });
    if (url.includes("/attendance/reports/monthly")) return jsonResponse({ team: "blow", month: "2026-05", month_start: "2026-05-01", month_end: "2026-05-31", detail_labels: ["Máy nhỏ"], rows: [], grand_total: "0", total_paid_workdays: 0 });
    if (url.includes("/attendance/employees") && method === "GET") return jsonResponse(employees.filter((employee) => employee.is_active || url.includes("include_inactive=true")));
    if (url.endsWith("/attendance/employees") && method === "POST") {
      const payload = JSON.parse(String(init?.body ?? "{}"));
      const row = { id: nextEmployeeId++, display_name: payload.display_name, team: payload.team, is_active: payload.is_active ?? true, user_id: null, legacy_employee_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" };
      employees = [...employees, row];
      return jsonResponse(row, 201);
    }
    if (/\/attendance\/employees\/\d+$/.test(url) && method === "PATCH") {
      const employeeId = Number(url.split("/").pop());
      const payload = JSON.parse(String(init?.body ?? "{}"));
      employees = employees.map((row) => (row.id === employeeId ? { ...row, ...payload } : row));
      return jsonResponse(employees.find((row) => row.id === employeeId));
    }
    if (/\/attendance\/employees\/\d+$/.test(url) && method === "DELETE") {
      const employeeId = Number(url.split("/").pop());
      const hasHistory = [...records.values()].some((record) => record.employee_id === employeeId);
      if (hasHistory) {
        employees = employees.map((row) => (row.id === employeeId ? { ...row, is_active: false } : row));
        return jsonResponse({ employee_id: employeeId, action: "deactivated" });
      }
      employees = employees.filter((row) => row.id !== employeeId);
      return jsonResponse({ employee_id: employeeId, action: "hard_deleted" });
    }
    if (url.includes("/attendance/day-entry?") && method === "GET") {
      const parsed = new URL(url);
      const selectedDate = parsed.searchParams.get("date") ?? "";
      const statuses = employees.filter((employee) => employee.is_active).map((employee) => {
        const record = records.get(key(employee.id, selectedDate));
        return {
          id: employee.id,
          display_name: employee.display_name,
          team: employee.team,
          is_active: employee.is_active,
          status: !record ? "not_started" : record.is_absent ? "absent" : record.status,
          record_status: record?.status ?? null,
          is_absent: record?.is_absent ?? false,
        };
      });
      return jsonResponse(statuses);
    }
    if (/\/attendance\/day-entry\/\d+\?/.test(url) && method === "GET") {
      const parsed = new URL(url);
      const employeeId = Number(parsed.pathname.split("/").pop());
      const selectedDate = parsed.searchParams.get("date") ?? "";
      const employee = employees.find((row) => row.id === employeeId)!;
      const record = records.get(key(employeeId, selectedDate));
      return jsonResponse({
        employee_id: employee.id,
        display_name: employee.display_name,
        team: employee.team,
        selected_date: selectedDate,
        status: !record ? "not_started" : record.is_absent ? "absent" : record.status,
        record_status: record?.status ?? null,
        is_absent: record?.is_absent ?? false,
        total_amount_snapshot: record?.total_amount_snapshot ?? "0",
        work_types: workTypes,
        bag_types: bagTypes,
        work_logs: [],
        cut_logs: [],
        extra_cut_logs: [],
      });
    }
    if (/\/attendance\/day-entry\/\d+\?/.test(url) && method === "PUT") {
      const parsed = new URL(url);
      const employeeId = Number(parsed.pathname.split("/").pop());
      const selectedDate = parsed.searchParams.get("date") ?? "";
      const finalize = parsed.searchParams.get("finalize") === "true";
      const payload = JSON.parse(String(init?.body ?? "{}"));
      if (options?.lockedDates?.includes(selectedDate)) {
        return jsonResponse({ error: { code: "validation_error", message: "Locked attendance periods cannot be edited." } }, 422);
      }
      if (options?.forceSaveErrorMessage) {
        return jsonResponse({ error: { code: "validation_error", message: options.forceSaveErrorMessage } }, 422);
      }
      const record = {
        record_id: records.get(key(employeeId, selectedDate))?.record_id ?? nextRecordId++,
        employee_id: employeeId,
        selected_date: selectedDate,
        status: finalize ? "done" : "draft",
        is_absent: Boolean(payload.is_absent),
        total_amount_snapshot: "0",
        blow_work: payload.blow_work ?? [],
        cut_work: payload.cut_work ?? [],
        extra_cut_work: payload.extra_cut_work ?? [],
      } satisfies StoredRecord;
      records.set(key(employeeId, selectedDate), record);
      return jsonResponse({ record_id: record.record_id, status: record.status, is_absent: record.is_absent, total_amount_snapshot: "0" });
    }
    return jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function mockAttendanceSession(role: UserRole, options?: { lockedDates?: string[]; forceSaveErrorMessage?: string | null }) {
  setRefreshToken("stored-refresh");
  let nextEmployeeId = 4;
  let nextRecordId = 10;
  let employees = [
    {
      id: 1,
      display_name: "Blow A",
      team: "blow",
      is_active: true,
      user_id: null,
      legacy_employee_id: null,
      created_at: "2026-05-17T00:00:00Z",
      updated_at: "2026-05-17T00:00:00Z",
    },
    {
      id: 2,
      display_name: "Cut B",
      team: "cut",
      is_active: true,
      user_id: null,
      legacy_employee_id: null,
      created_at: "2026-05-17T00:00:00Z",
      updated_at: "2026-05-17T00:00:00Z",
    },
    {
      id: 3,
      display_name: "Inactive C",
      team: "cut",
      is_active: false,
      user_id: null,
      legacy_employee_id: null,
      created_at: "2026-05-17T00:00:00Z",
      updated_at: "2026-05-17T00:00:00Z",
    },
  ];

  const workTypes = [
    { id: 1, name: "Thừa máy", team: "blow", input_type: "quantity", pricing_rule: "quantity_excess_over_quota", quota_quantity: "3", unit_price: "30000", exclusive_group: null, is_active: true, legacy_work_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
    { id: 2, name: "Máy nhỏ", team: "blow", input_type: "quantity", pricing_rule: "quantity_full", quota_quantity: null, unit_price: "30000", exclusive_group: null, is_active: true, legacy_work_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
    { id: 3, name: "Phụ găng 1 máy", team: "blow", input_type: "tick", pricing_rule: "flat_tick", quota_quantity: null, unit_price: "30000", exclusive_group: "glove", is_active: true, legacy_work_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
    { id: 4, name: "Phụ găng 2 máy", team: "blow", input_type: "tick", pricing_rule: "flat_tick", quota_quantity: null, unit_price: "50000", exclusive_group: "glove", is_active: true, legacy_work_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
  ];

  const bagTypes = [
    { id: 11, name: "Bao 25kg", product_id: null, source_product_name_snapshot: null, quota_quantity: "25.00", excess_unit_price: "3500", is_active: true, is_product_linked: true, is_excluded_from_attendance: false, is_legacy: false, legacy_bag_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
    { id: 12, name: "Bao 50kg", product_id: null, source_product_name_snapshot: null, quota_quantity: "30.00", excess_unit_price: "4200", is_active: true, is_product_linked: true, is_excluded_from_attendance: false, is_legacy: false, legacy_bag_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
  ];

  type StoredRecord = {
    record_id: number;
    employee_id: number;
    selected_date: string;
    status: "draft" | "done";
    is_absent: boolean;
    total_amount_snapshot: string;
    blow_work: { work_type_id: number; quantity: string | null }[];
    cut_work: { bag_type_id: number; quantity: string }[];
    extra_cut_work: { bag_type_id: number; quantity: string }[];
  };

  const records = new Map<string, StoredRecord>();

  function key(employeeId: number, selectedDate: string) {
    return `${employeeId}:${selectedDate}`;
  }

  function money(value: number) {
    return String(Math.round(value));
  }

  function quantity(value: string | number) {
    return Number(value).toFixed(3);
  }

  function computeBlowTotal(blowWork: { work_type_id: number; quantity: string | null }[], extraCutWork: { bag_type_id: number; quantity: string }[]) {
    let total = 0;
    for (const item of blowWork) {
      const workType = workTypes.find((row) => row.id === item.work_type_id);
      if (!workType) continue;
      if (workType.input_type === "tick") {
        total += Number(workType.unit_price);
        continue;
      }
      const qty = Number(item.quantity ?? "0");
      if (workType.pricing_rule === "quantity_excess_over_quota") {
        total += Math.round(Math.max(0, qty - Number(workType.quota_quantity ?? "0")) * Number(workType.unit_price));
      } else {
        total += Math.round(qty * Number(workType.unit_price));
      }
    }
    for (const item of extraCutWork) {
      const bagType = bagTypes.find((row) => row.id === item.bag_type_id);
      if (!bagType) continue;
      total += Math.round(Number(item.quantity) * Number(bagType.excess_unit_price));
    }
    return money(total);
  }

  function computeCutTotal(cutWork: { bag_type_id: number; quantity: string }[]) {
    const activeRows = cutWork
      .map((item) => ({ item, bagType: bagTypes.find((row) => row.id === item.bag_type_id) }))
      .filter((row): row is { item: { bag_type_id: number; quantity: string }; bagType: (typeof bagTypes)[number] } => Boolean(row.bagType))
      .map(({ item, bagType }) => ({
        quantity: Number(item.quantity),
        quota: Number(bagType.quota_quantity),
        price: Number(bagType.excess_unit_price),
      }))
      .filter((row) => row.quantity > 0);

    if (activeRows.length === 0) {
      return "0";
    }
    const totalQuantity = activeRows.reduce((sum, row) => sum + row.quantity, 0);
    const quotaAverage = activeRows.reduce((sum, row) => sum + row.quota, 0) / activeRows.length;
    if (totalQuantity <= quotaAverage) {
      return "0";
    }
    if (activeRows.some((row) => row.quantity >= row.quota)) {
      return money(
        activeRows.reduce((sum, row) => (
          sum + Math.round(row.quantity >= row.quota ? Math.max(0, row.quantity - row.quota) * row.price : row.quantity * row.price)
        ), 0),
      );
    }
    return money(
      activeRows.reduce((sum, row) => sum + Math.round(Math.max(0, row.quantity - (row.quota / activeRows.length)) * row.price), 0),
    );
  }

  function buildStatusRow(employee: (typeof employees)[number], selectedDate: string) {
    const record = records.get(key(employee.id, selectedDate));
    const status = !record ? "not_started" : record.is_absent ? "absent" : record.status === "done" ? "done" : "draft";
    return {
      id: employee.id,
      display_name: employee.display_name,
      team: employee.team,
      is_active: employee.is_active,
      status,
      record_status: record?.status ?? null,
      is_absent: record?.is_absent ?? false,
    };
  }

  function buildDetail(employeeId: number, selectedDate: string) {
    const employee = employees.find((row) => row.id === employeeId)!;
    const record = records.get(key(employeeId, selectedDate));
    return {
      employee_id: employee.id,
      display_name: employee.display_name,
      team: employee.team,
      selected_date: selectedDate,
      status: buildStatusRow(employee, selectedDate).status,
      record_status: record?.status ?? null,
      is_absent: record?.is_absent ?? false,
      total_amount_snapshot: record?.total_amount_snapshot ?? "0",
      work_types: employee.team === "blow" ? workTypes : [],
      bag_types: bagTypes,
      work_logs: (record?.blow_work ?? []).map((item) => {
        const workType = workTypes.find((row) => row.id === item.work_type_id)!;
        return {
          work_type_id: item.work_type_id,
          quantity: workType.input_type === "tick" ? "1.000" : quantity(item.quantity ?? "0"),
          unit_price_snapshot: workType.unit_price,
          amount_snapshot: workType.input_type === "tick"
            ? workType.unit_price
            : workType.pricing_rule === "quantity_excess_over_quota"
              ? money(Math.max(0, Number(item.quantity ?? "0") - Number(workType.quota_quantity ?? "0")) * Number(workType.unit_price))
              : money(Number(item.quantity ?? "0") * Number(workType.unit_price)),
        };
      }),
      cut_logs: (record?.cut_work ?? []).map((item) => {
        const bagType = bagTypes.find((row) => row.id === item.bag_type_id)!;
        return {
          bag_type_id: item.bag_type_id,
          quantity: quantity(item.quantity),
          quota_quantity_snapshot: bagType.quota_quantity,
          excess_unit_price_snapshot: bagType.excess_unit_price,
          amount_snapshot: "0",
        };
      }),
      extra_cut_logs: (record?.extra_cut_work ?? []).map((item) => {
        const bagType = bagTypes.find((row) => row.id === item.bag_type_id)!;
        return {
          bag_type_id: item.bag_type_id,
          quantity: quantity(item.quantity),
          excess_unit_price_snapshot: bagType.excess_unit_price,
          amount_snapshot: money(Number(item.quantity) * Number(bagType.excess_unit_price)),
        };
      }),
    };
  }

  function buildPeriodReport(team: "blow" | "cut") {
    if (team === "blow") {
      return {
        team,
        period_id: 1,
        start_date: "2026-05-01",
        end_date: "2026-05-10",
        detail_labels: ["Máy nhỏ", "VK"],
        employee_summaries: [
          { employee_id: 1, display_name: "Blow A", total_amount: "66750", paid_workdays: 1 },
        ],
        rows: [
          {
            work_date: "2026-05-06",
            employee_values: [
              {
                employee_id: 1,
                display_name: "Blow A",
                details: { "Máy nhỏ": "1", VK: "36750" },
                total_amount: "66750",
                is_absent: false,
                status: "done",
              },
            ],
            day_total: "66750",
          },
        ],
        grand_total: "66750",
        total_paid_workdays: 1,
      };
    }
    return {
      team,
      period_id: 1,
      start_date: "2026-05-01",
      end_date: "2026-05-10",
      detail_labels: ["Bao 25kg", "Bao 50kg"],
      employee_summaries: [
        { employee_id: 2, display_name: "Cut B", total_amount: "100000", paid_workdays: 1 },
        { employee_id: 3, display_name: "Inactive C", total_amount: "50000", paid_workdays: 1 },
      ],
      rows: [
        {
          work_date: "2026-05-07",
          employee_values: [
            {
              employee_id: 2,
              display_name: "Cut B",
              details: { "Bao 25kg": "10", "Bao 50kg": "20" },
              total_amount: "100000",
              is_absent: false,
              status: "done",
            },
            {
              employee_id: 3,
              display_name: "Inactive C",
              details: { "Bao 25kg": "5" },
              total_amount: "50000",
              is_absent: false,
              status: "done",
            },
          ],
          day_total: "150000",
        },
      ],
      grand_total: "150000",
      total_paid_workdays: 2,
    };
  }

  function buildMonthlyReport(team: "blow" | "cut", month: string) {
    if (team === "blow") {
      return {
        team,
        month,
        month_start: `${month}-01`,
        month_end: `${month}-31`,
        detail_labels: ["Máy nhỏ", "VK"],
        rows: [
          { employee_id: 1, display_name: "Blow A", details: { "Máy nhỏ": "1", VK: "36750" }, total_amount: "66750", paid_workdays: 1 },
        ],
        grand_total: "66750",
        total_paid_workdays: 1,
      };
    }
    return {
      team,
      month,
      month_start: `${month}-01`,
      month_end: `${month}-31`,
      detail_labels: ["Bao 25kg", "Bao 50kg"],
      rows: [
        { employee_id: 2, display_name: "Cut B", details: { "Bao 25kg": "10", "Bao 50kg": "20" }, total_amount: "100000", paid_workdays: 1 },
        { employee_id: 3, display_name: "Inactive C", details: { "Bao 25kg": "5" }, total_amount: "50000", paid_workdays: 1 },
      ],
      grand_total: "150000",
      total_paid_workdays: 2,
    };
  }

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.endsWith("/auth/refresh")) return jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 });
    if (url.endsWith("/auth/me")) return jsonResponse(user(role));
    if (url.endsWith("/auth/logout")) return jsonResponse({ status: "ok" });
    if (url.endsWith("/attendance/reference")) return jsonResponse({ teams: ["blow", "cut"], record_statuses: ["draft", "done"] });
    if (url.includes("/attendance/work-types")) return jsonResponse(workTypes);
    if (url.includes("/attendance/cut-work-items")) return jsonResponse(bagTypes);
    if (url.includes("/attendance/reports/period")) {
      const parsedUrl = new URL(url);
      return jsonResponse(buildPeriodReport((parsedUrl.searchParams.get("team") as "blow" | "cut") ?? "blow"));
    }
    if (url.includes("/attendance/reports/monthly")) {
      const parsedUrl = new URL(url);
      return jsonResponse(
        buildMonthlyReport(
          (parsedUrl.searchParams.get("team") as "blow" | "cut") ?? "blow",
          parsedUrl.searchParams.get("month") ?? "2026-05",
        ),
      );
    }

    if (url.includes("/attendance/employees") && method === "GET") {
      const parsedUrl = new URL(url);
      const search = (parsedUrl.searchParams.get("search") ?? "").toLowerCase();
      const includeInactive = parsedUrl.searchParams.get("include_inactive") === "true";
      const team = parsedUrl.searchParams.get("team");
      const filtered = employees.filter((employee) => {
        if (!includeInactive && !employee.is_active) return false;
        if (team && employee.team !== team) return false;
        if (search && !employee.display_name.toLowerCase().includes(search)) return false;
        return true;
      });
      return jsonResponse(filtered);
    }

    if (url.endsWith("/attendance/employees") && method === "POST") {
      const payload = JSON.parse(String(init?.body ?? "{}"));
      const employee = {
        id: nextEmployeeId++,
        display_name: payload.display_name,
        team: payload.team,
        is_active: payload.is_active ?? true,
        user_id: null,
        legacy_employee_id: null,
        created_at: "2026-05-17T00:00:00Z",
        updated_at: "2026-05-17T00:00:00Z",
      };
      employees = [...employees, employee];
      return jsonResponse(employee, 201);
    }

    if (/\/attendance\/employees\/\d+$/.test(url) && method === "GET") {
      const employeeId = Number(url.split("/").pop());
      return jsonResponse(employees.find((row) => row.id === employeeId));
    }

    if (/\/attendance\/employees\/\d+$/.test(url) && method === "PATCH") {
      const employeeId = Number(url.split("/").pop());
      const payload = JSON.parse(String(init?.body ?? "{}"));
      employees = employees.map((employee) => employee.id === employeeId ? { ...employee, ...payload } : employee);
      return jsonResponse(employees.find((row) => row.id === employeeId));
    }

    if (/\/attendance\/employees\/\d+$/.test(url) && method === "DELETE") {
      const employeeId = Number(url.split("/").pop());
      const hasHistory = [...records.values()].some((record) => record.employee_id === employeeId);
      if (hasHistory) {
        employees = employees.map((employee) => employee.id === employeeId ? { ...employee, is_active: false } : employee);
        return jsonResponse({ employee_id: employeeId, action: "deactivated" });
      }
      employees = employees.filter((employee) => employee.id !== employeeId);
      return jsonResponse({ employee_id: employeeId, action: "hard_deleted" });
    }

    if (url.includes("/attendance/periods/ensure-for-date") && method === "POST") {
      const payload = JSON.parse(String(init?.body ?? "{}"));
      const selectedDate = payload.selected_date;
      if (selectedDate === "2026-05-06" || selectedDate === "2026-05-08") {
        return jsonResponse({ id: 1, start_date: "2026-05-01", end_date: "2026-05-10", locked: false, legacy_period_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" }, 201);
      }
      if (selectedDate === "2024-02-29") {
        return jsonResponse({ id: 2, start_date: "2024-02-21", end_date: "2024-02-29", locked: false, legacy_period_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" }, 201);
      }
      return jsonResponse({ id: 3, start_date: "2026-05-21", end_date: "2026-05-31", locked: false, legacy_period_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" }, 201);
    }

    if (url.includes("/attendance/periods") && method === "GET") {
      return jsonResponse([
        { id: 1, start_date: "2026-05-01", end_date: "2026-05-10", locked: false, legacy_period_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
        { id: 2, start_date: "2024-02-21", end_date: "2024-02-29", locked: false, legacy_period_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
      ]);
    }

    if (/\/attendance\/periods\/\d+$/.test(url) && method === "PATCH") {
      const payload = JSON.parse(String(init?.body ?? "{}"));
      return jsonResponse({ id: 3, start_date: "2026-05-21", end_date: "2026-05-31", locked: payload.locked, legacy_period_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" });
    }

    if (url.includes("/attendance/day-entry?") && method === "GET") {
      const parsedUrl = new URL(url);
      const selectedDate = parsedUrl.searchParams.get("date") ?? "";
      return jsonResponse(employees.filter((employee) => employee.is_active).map((employee) => buildStatusRow(employee, selectedDate)));
    }

    if (/\/attendance\/day-entry\/\d+\?/.test(url) && method === "GET") {
      const parsedUrl = new URL(url);
      const employeeId = Number(parsedUrl.pathname.split("/").pop());
      const selectedDate = parsedUrl.searchParams.get("date") ?? "";
      return jsonResponse(buildDetail(employeeId, selectedDate));
    }

    if (/\/attendance\/day-entry\/\d+\?/.test(url) && method === "PUT") {
      const parsedUrl = new URL(url);
      const employeeId = Number(parsedUrl.pathname.split("/").pop());
      const selectedDate = parsedUrl.searchParams.get("date") ?? "";
      const finalize = parsedUrl.searchParams.get("finalize") === "true";
      const payload = JSON.parse(String(init?.body ?? "{}"));

      if (options?.lockedDates?.includes(selectedDate)) {
        return jsonResponse({ error: { code: "validation_error", message: "Locked attendance periods cannot be edited." } }, 422);
      }
      if (options?.forceSaveErrorMessage) {
        return jsonResponse({ error: { code: "validation_error", message: options.forceSaveErrorMessage } }, 422);
      }
      if ((payload.blow_work ?? []).some((item: { work_type_id: number }) => item.work_type_id === 3)
        && (payload.blow_work ?? []).some((item: { work_type_id: number }) => item.work_type_id === 4)) {
        return jsonResponse({ error: { code: "validation_error", message: "Glove work types are mutually exclusive in the same daily record." } }, 422);
      }

      let total = "0";
      if (!payload.is_absent) {
        const employee = employees.find((row) => row.id === employeeId)!;
        if (employee.team === "blow") {
          total = computeBlowTotal(payload.blow_work ?? [], payload.extra_cut_work ?? []);
        } else {
          total = computeCutTotal(payload.cut_work ?? []);
        }
      }

      const record = {
        record_id: records.get(key(employeeId, selectedDate))?.record_id ?? nextRecordId++,
        employee_id: employeeId,
        selected_date: selectedDate,
        status: finalize ? "done" : "draft",
        is_absent: Boolean(payload.is_absent),
        total_amount_snapshot: payload.is_absent ? "0" : total,
        blow_work: payload.is_absent ? [] : payload.blow_work ?? [],
        cut_work: payload.is_absent ? [] : payload.cut_work ?? [],
        extra_cut_work: payload.is_absent ? [] : payload.extra_cut_work ?? [],
      } satisfies StoredRecord;
      records.set(key(employeeId, selectedDate), record);
      return jsonResponse({
        record_id: record.record_id,
        status: record.status,
        is_absent: record.is_absent,
        total_amount_snapshot: record.total_amount_snapshot,
      });
    }

    return jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
