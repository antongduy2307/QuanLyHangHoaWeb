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
