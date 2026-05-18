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
      updated_at: "2026-05-17T00:00:00Z",
    },
  };
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
    if (url.includes("/inventory/products") && init?.method === "POST") {
      return Promise.resolve(jsonResponse(productFixture(), 201));
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
    if (url.endsWith("/sales/invoices")) {
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
    if (url.endsWith("/returns")) {
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

  it("creates a debt payment and refetches customer detail", async () => {
    const fetchMock = mockCustomerSession("owner", [customerFixture()], ledgerFixture(), []);
    const testUser = userEvent.setup();
    renderRoute("/customers/21");

    await testUser.click(await screen.findByRole("button", { name: "Them thanh toan" }));
    await testUser.type(screen.getByLabelText("So tien thanh toan"), "25000");
    await testUser.click(screen.getAllByRole("button", { name: "Them thanh toan" })[1]);

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/customers/21/debt-payments") && call[1]?.method === "POST")).toBe(true);
    });
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
    });
  });

  it("deletes a debt payment after confirmation", async () => {
    const fetchMock = mockCustomerSession("owner");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const testUser = userEvent.setup();
    renderRoute("/customers/21");

    await testUser.click(await screen.findByRole("button", { name: "Xoa" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/customers/21/debt-payments/41") && call[1]?.method === "DELETE")).toBe(true);
    });
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
    expect(screen.getByText("GAO-01")).toBeInTheDocument();
    expect(screen.getByText("Gao Thom")).toBeInTheDocument();
    expect(screen.getByText("Bao")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cap nhat hoa don" })).not.toBeInTheDocument();
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
    expect(screen.queryByRole("link", { name: "Tao phieu tra" })).not.toBeInTheDocument();
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
    expect(screen.getByText("5.000")).toBeInTheDocument();
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
