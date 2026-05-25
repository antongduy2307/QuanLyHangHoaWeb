import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setRefreshToken } from "../../auth/tokenStore";
import { jsonResponse, user } from "../../tests/appTestHarness";
import { renderRoute } from "../../tests/testUtils";

function activityItems() {
  return [
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
      event_type: "RETURN_INVOICE",
      event_id: 71,
      event_datetime: "2026-05-17T10:00:00Z",
      display_order: 0,
      code: "TR20260517-001",
      customer_id: 21,
      customer_name: "Cong ty Minh Anh",
      product_id: null,
      product_name: null,
      amount: "50000.00",
      paid_amount: null,
      item_count: 1,
      quantity: null,
      unit_type: null,
      status: "STORE_CREDIT",
      source_type: "return",
      source_id: 71,
      note: "Tra mot phan",
      open_target: { target_type: "return", target_id: 71, route: "/returns/71" },
    },
    {
      event_type: "STOCK_MOVEMENT",
      event_id: 81,
      event_datetime: "2026-05-17T11:00:00Z",
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
      status: "STOCK_SET",
      source_type: "stock_adjustment",
      source_id: 81,
      note: "Kiem kho",
      open_target: { target_type: "product", target_id: 10, route: "/inventory/products/10" },
    },
    {
      event_type: "ORDER",
      event_id: 61,
      event_datetime: "2026-05-17T12:00:00Z",
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
      note: "Don moi",
      open_target: { target_type: "order", target_id: 61, route: "/orders/61" },
    },
  ];
}

function stubDashboardFetch(options?: {
  topProducts?: unknown[];
  timeseriesBuckets?: unknown[];
  overview?: Record<string, unknown>;
  historyItems?: unknown[];
  historyStatus?: number;
}) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/auth/refresh")) {
      return Promise.resolve(
        jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 }),
      );
    }
    if (url.endsWith("/auth/me")) {
      return Promise.resolve(jsonResponse(user("read_only")));
    }
    if (url.endsWith("/reports/overview")) {
      return Promise.resolve(
        jsonResponse({
          today_invoice_count: 2,
          today_sales_total: "250000.00",
          today_return_count: 1,
          today_return_total: "50000.00",
          this_month_sales_total: "1250000.00",
          last_month_sales_total: "980000.00",
          last_7_days_sales_total: "410000.00",
          current_customer_debt: "85000.00",
          positive_debt_customer_count: 1,
          ...options?.overview,
        }),
      );
    }
    if (url.includes("/reports/sales-timeseries")) {
      return Promise.resolve(
        jsonResponse({
          period: "this_month",
          granularity: "day",
          buckets: options?.timeseriesBuckets ?? [
            { label: "2026-05-01", start_datetime: "2026-05-01T00:00:00Z", end_datetime: "2026-05-02T00:00:00Z", sales_total: "250000.00", invoice_count: 1 },
            { label: "2026-05-02", start_datetime: "2026-05-02T00:00:00Z", end_datetime: "2026-05-03T00:00:00Z", sales_total: "125000.00", invoice_count: 1 },
            { label: "2026-05-03", start_datetime: "2026-05-03T00:00:00Z", end_datetime: "2026-05-04T00:00:00Z", sales_total: "50000.00", invoice_count: 1 },
          ],
        }),
      );
    }
    if (url.includes("/reports/top-products")) {
      return Promise.resolve(
        jsonResponse(
          options?.topProducts ?? [
            { product_id: 10, product_code: "GAO-01", product_name: "Gao Thom", unit_type: "BAO", total_quantity: "4.000", total_revenue: "420000.00", invoice_count: 2 },
            { product_id: 11, product_code: "BOT-01", product_name: "Bot Giat", unit_type: "BICH", total_quantity: "6.000", total_revenue: "180000.00", invoice_count: 3 },
          ],
        ),
      );
    }
    if (url.includes("/history")) {
      if (options?.historyStatus && options.historyStatus !== 200) {
        return Promise.resolve(jsonResponse({ error: { code: "history_failed", message: "History failed" } }, options.historyStatus));
      }
      return Promise.resolve(
        jsonResponse({
          page: 1,
          page_size: 8,
          total: options?.historyItems?.length ?? activityItems().length,
          items: options?.historyItems ?? activityItems(),
        }),
      );
    }
    if (url.endsWith("/reports/customer-debts")) {
      return Promise.resolve(jsonResponse([{ customer_id: 21, customer_name: "Cong ty Minh Anh", phone: "0909000000", current_balance: "85000.00", total_sales: "500000.00", is_active: true }]));
    }
    if (url.endsWith("/reports/inventory-summary")) {
      return Promise.resolve(jsonResponse([{ product_id: 10, product_code_base: "GAO-01", product_name: "Gao Thom", unit_mode: "BAO_KG", is_active: true, balance_value: "5.000", balance_unit: "BAO", prices: [] }]));
    }
    if (url.includes("/reports/sales-summary")) {
      return Promise.resolve(jsonResponse({ total_sales: "250000.00", total_paid: "150000.00", invoice_count: 1, average_invoice_total: "250000.00", by_day: [] }));
    }
    if (url.includes("/reports/returns-summary")) {
      return Promise.resolve(jsonResponse({ total_returns: "50000.00", return_count: 1, by_day: [] }));
    }
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404));
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("dashboard and reports", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("renders dashboard overview cards, vertical chart, top-products section, and recent activity", async () => {
    setRefreshToken("stored-refresh");
    stubDashboardFetch();

    renderRoute("/");

    expect(await screen.findByRole("heading", { name: /T.ng quan/i })).toBeInTheDocument();
    expect((await screen.findAllByText("250.000")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("85.000")).toBeInTheDocument();
    expect(document.querySelectorAll(".dashboard-overview-card")).toHaveLength(8);
    expect(screen.getByRole("heading", { name: /Doanh thu theo th.i gian/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Top h.ng b.n ch.y/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Ho.t ..ng g.n ..y/i })).toBeInTheDocument();
    expect(screen.getAllByTestId("dashboard-revenue-bar")).toHaveLength(3);
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText("03")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "GAO-01" })).toBeInTheDocument();
    expect(screen.getByText("420.000")).toBeInTheDocument();
    expect(screen.getByText("HD20260517-001")).toBeInTheDocument();
  });

  it("renders only the monthly period controls", async () => {
    setRefreshToken("stored-refresh");
    stubDashboardFetch();

    renderRoute("/");

    expect(await screen.findByRole("button", { name: "Tháng này" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tháng trước" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hôm nay" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hôm qua" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "7 ngày qua" })).not.toBeInTheDocument();
  });

  it("renders only the redesigned dashboard shell and marks Tổng quan active once", async () => {
    setRefreshToken("stored-refresh");
    stubDashboardFetch();

    renderRoute("/");

    await screen.findByRole("heading", { name: /T.ng quan/i });

    expect(screen.queryByLabelText("Dieu huong chinh")).not.toBeInTheDocument();
    expect(screen.queryByText("Moi truong quan tri")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Điều hướng chính")).toBeInTheDocument();
    expect(document.querySelectorAll(".inventory-top-shell")).toHaveLength(1);
    expect(document.querySelectorAll(".inventory-top-nav__link")).toHaveLength(8);
    expect(document.querySelectorAll(".inventory-top-nav__link.active")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Tổng quan" })).toHaveClass("active");
  });

  it("dashboard fetches recent history with page and page_size", async () => {
    setRefreshToken("stored-refresh");
    const fetchMock = stubDashboardFetch();

    renderRoute("/");

    await screen.findByRole("heading", { name: /Ho.t ..ng g.n ..y/i });

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => {
          const url = new URL(String(call[0]));
          return url.pathname.endsWith("/history") && url.searchParams.get("page") === "1" && url.searchParams.get("page_size") === "8";
        }),
      ).toBe(true);
    });
  });

  it("monthly period renders a scrollable chart container", async () => {
    setRefreshToken("stored-refresh");
    stubDashboardFetch({
      timeseriesBuckets: Array.from({ length: 31 }, (_, index) => ({
        label: `2026-05-${String(index + 1).padStart(2, "0")}`,
        start_datetime: `2026-05-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
        end_datetime: `2026-05-${String(index + 2).padStart(2, "0")}T00:00:00Z`,
        sales_total: `${(index + 1) * 1000}.00`,
        invoice_count: 1,
      })),
    });

    renderRoute("/");

    expect(await screen.findByTestId("dashboard-revenue-scroll")).toHaveAttribute("data-scrollable", "true");
    expect(screen.getAllByTestId("dashboard-revenue-bar")).toHaveLength(31);
  });

  it("period selector still calls API", async () => {
    setRefreshToken("stored-refresh");
    const fetchMock = stubDashboardFetch();
    const testUser = userEvent.setup();

    renderRoute("/");
    await screen.findByRole("heading", { name: /Doanh thu theo th.i gian/i });
    await testUser.click(screen.getByRole("button", { name: "Tháng trước" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("period=last_month") && String(call[0]).includes("granularity=day"))).toBe(true);
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/reports/top-products") && String(call[0]).includes("period=last_month"))).toBe(true);
    });
  });

  it("renders bars without pillar containers and without top value labels", async () => {
    setRefreshToken("stored-refresh");
    stubDashboardFetch();

    renderRoute("/");

    await screen.findByRole("heading", { name: /Doanh thu theo th.i gian/i });

    expect(document.querySelectorAll(".dashboard-revenue-chart__bar-track")).toHaveLength(0);
    expect(document.querySelectorAll(".dashboard-revenue-chart__value")).toHaveLength(0);
    expect(document.querySelectorAll(".dashboard-revenue-chart__meta")).toHaveLength(0);
  });

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
        if (url.endsWith("/auth/me")) {
          return Promise.resolve(jsonResponse(user("read_only")));
        }
        if (url.endsWith("/reports/overview")) return new Promise(() => {});
        if (url.includes("/reports/sales-timeseries")) return new Promise(() => {});
        if (url.includes("/reports/top-products")) return new Promise(() => {});
        if (url.includes("/history")) return new Promise(() => {});
        return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404));
      }),
    );

    renderRoute("/");

    expect(await screen.findByText("Đang tải tổng quan...")).toBeInTheDocument();
  });

  it("renders dashboard error state", async () => {
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
          return Promise.resolve(jsonResponse(user("read_only")));
        }
        if (url.endsWith("/reports/overview")) {
          return Promise.resolve(jsonResponse({ error: { code: "report_failed", message: "Overview failed" } }, 500));
        }
        return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404));
      }),
    );

    renderRoute("/");

    expect(await screen.findByText("Overview failed")).toBeInTheDocument();
  });

  it("renders dashboard timeseries empty state", async () => {
    setRefreshToken("stored-refresh");
    stubDashboardFetch({
      timeseriesBuckets: [],
    });

    renderRoute("/");

    expect(await screen.findByText("Chưa có doanh thu trong chu kỳ được chọn.")).toBeInTheDocument();
  });

  it("renders dashboard top-products empty state", async () => {
    setRefreshToken("stored-refresh");
    stubDashboardFetch({
      topProducts: [],
      overview: {
        today_invoice_count: 1,
        today_sales_total: "250000.00",
        today_return_count: 0,
        today_return_total: "0",
        this_month_sales_total: "250000.00",
        last_month_sales_total: "0",
        last_7_days_sales_total: "250000.00",
        current_customer_debt: "0",
        positive_debt_customer_count: 0,
      },
    });

    renderRoute("/");

    expect(await screen.findByText("Chưa có dữ liệu hàng bán chạy trong chu kỳ được chọn.")).toBeInTheDocument();
  });

  it("renders recent activity event labels and supported open links", async () => {
    setRefreshToken("stored-refresh");
    stubDashboardFetch();

    renderRoute("/");

    expect(await screen.findByText("Hóa đơn bán hàng")).toBeInTheDocument();
    expect(screen.getByText("Phiếu trả hàng")).toBeInTheDocument();
    expect(screen.getByText("Biến động tồn kho")).toBeInTheDocument();
    const openLinks = screen.getAllByRole("link", { name: "Mở" });
    expect(openLinks.some((link) => link.getAttribute("href") === "/sales/invoices/51")).toBe(true);
    expect(openLinks.some((link) => link.getAttribute("href") === "/returns/71")).toBe(true);
    expect(openLinks.some((link) => link.getAttribute("href") === "/inventory/products/10")).toBe(true);
  });

  it("does not render a broken order link in recent activity", async () => {
    setRefreshToken("stored-refresh");
    stubDashboardFetch();

    renderRoute("/");

    await screen.findByText("DH20260517-001");
    const orderRow = screen.getByText("DH20260517-001").closest("tr");
    expect(orderRow?.textContent).toContain("Đặt hàng");
    expect(orderRow?.querySelector("a")).toBeNull();
  });

  it("renders recent activity empty state", async () => {
    setRefreshToken("stored-refresh");
    stubDashboardFetch({ historyItems: [] });

    renderRoute("/");

    expect(await screen.findByText("Chưa có hoạt động gần đây.")).toBeInTheDocument();
  });

  it("renders recent activity error state", async () => {
    setRefreshToken("stored-refresh");
    stubDashboardFetch({ historyStatus: 500 });

    renderRoute("/");

    expect(await screen.findByText("History failed")).toBeInTheDocument();
  });

  it("renders top-products table sorted by revenue", async () => {
    setRefreshToken("stored-refresh");
    stubDashboardFetch({
      topProducts: [
        { product_id: 2, product_code: "BOT-01", product_name: "Bot Giat", unit_type: "BICH", total_quantity: "5.000", total_revenue: "180000.00", invoice_count: 2 },
        { product_id: 1, product_code: "GAO-01", product_name: "Gao Thom", unit_type: "BAO", total_quantity: "3.000", total_revenue: "420000.00", invoice_count: 1 },
      ],
    });

    renderRoute("/");

    const rows = await screen.findAllByRole("row");
    const topProductRows = rows.filter((row) => row.textContent?.includes("GAO-01") || row.textContent?.includes("BOT-01"));
    expect(topProductRows).toHaveLength(2);
    expect(topProductRows[0].textContent).toContain("GAO-01");
    expect(topProductRows[0].textContent).toContain("420.000");
    expect(topProductRows[1].textContent).toContain("BOT-01");
    expect(topProductRows[1].textContent).toContain("180.000");
  });

  it("renders reports read-only view", async () => {
    setRefreshToken("stored-refresh");
    stubDashboardFetch();

    renderRoute("/reports");

    expect(await screen.findByRole("heading", { name: "Bao cao" })).toBeInTheDocument();
    expect(await screen.findByText("Cong ty Minh Anh")).toBeInTheDocument();
    expect(await screen.findByText("Gao Thom")).toBeInTheDocument();
  });
});
