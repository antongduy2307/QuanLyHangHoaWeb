import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { RouterProvider, createMemoryRouter, type InitialEntry } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { appRoutes } from "../../app/router";
import { AuthProvider } from "../../auth/AuthProvider";
import { setRefreshToken } from "../../auth/tokenStore";
import {
  bichProductFixture,
  customerFixture,
  invoiceFixture,
  jsonResponse,
  productFixture,
  returnFixture,
  user,
} from "../../tests/appTestHarness";
import { toLocalDateTimeInput } from "./invoiceSchemas";

type SalesPosMockOptions = {
  customers?: unknown[];
  products?: unknown[];
  returns?: unknown[];
  invoice?: ReturnType<typeof invoiceFixture>;
  invoices?: unknown[];
  failInvoiceFetch?: boolean;
};

function mockSalesPosSession(role: "owner" | "admin" | "read_only" = "owner", options: SalesPosMockOptions = {}) {
  setRefreshToken("stored-refresh");
  const invoice = options.invoice ?? invoiceFixture();
  const invoices = options.invoices ?? [invoice];
  const customers = options.customers ?? [customerFixture()];
  const products = options.products ?? [productFixture(), bichProductFixture()];
  const returns = options.returns ?? [returnFixture()];

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
      return Promise.resolve(jsonResponse(products));
    }
    if (url.includes("/customers")) {
      return Promise.resolve(jsonResponse(customers));
    }
    if (url.endsWith("/returns") || url.includes("/returns?")) {
      return Promise.resolve(jsonResponse(returns));
    }
    if (url.endsWith(`/sales/invoices/${invoice.id}`) && init?.method === "PATCH") {
      return Promise.resolve(jsonResponse({ ...invoice, paid_amount: invoice.paid_amount, note: invoice.note }));
    }
    if (url.endsWith("/sales/invoices") && init?.method === "POST") {
      return Promise.resolve(jsonResponse(invoice, 201));
    }
    if (url.endsWith(`/sales/invoices/${invoice.id}`) && options.failInvoiceFetch) {
      return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Invoice not found" } }, 404));
    }
    if (url.endsWith(`/sales/invoices/${invoice.id}`)) {
      return Promise.resolve(jsonResponse(invoice));
    }
    if (url.endsWith("/sales/invoices") || url.includes("/sales/invoices?")) {
      return Promise.resolve(jsonResponse(invoices));
    }
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404));
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderSalesRoute(initialEntry: InitialEntry = "/sales/invoices/new") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const router = createMemoryRouter(appRoutes, { initialEntries: [initialEntry] });

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  }

  const view = render(<RouterProvider router={router} />, { wrapper: Wrapper });
  return { router, ...view };
}

function activeTabLabel(container: HTMLElement) {
  return container.querySelector(".sales-draft-tab.active button")?.textContent ?? "";
}

function payButton(container: HTMLElement) {
  return container.querySelector(".sales-pay-button") as HTMLButtonElement;
}

function cancelEditButton(container: HTMLElement) {
  const buttons = Array.from(container.querySelectorAll(".sales-payment-panel .inventory-ghost-button"));
  return buttons[buttons.length - 1] as HTMLButtonElement;
}

function paidAmountInput(container: HTMLElement) {
  return container.querySelector(".sales-payment-panel input[inputmode='decimal']") as HTMLInputElement;
}

describe("InvoiceCreatePage edit draft mode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("route state editInvoiceDraft fetches invoice and creates an edit tab with preloaded fields", async () => {
    const invoice = invoiceFixture();
    mockSalesPosSession("owner", { invoice });
    const { container } = renderSalesRoute({
      pathname: "/sales/invoices/new",
      state: { editInvoiceDraft: { invoiceId: invoice.id, returnTo: `/sales/invoices/${invoice.id}`, returnLabel: "Quay l\u1ea1i h\u00f3a \u0111\u01a1n" } },
    });

    await waitFor(() => {
      expect(activeTabLabel(container)).toContain(invoice.invoice_code);
    });
    expect(activeTabLabel(container)).not.toContain("B\u00e1n h\u00e0ng 1");
    expect(screen.getByDisplayValue(toLocalDateTimeInput(invoice.invoice_datetime))).toBeInTheDocument();
    expect(screen.getByDisplayValue(invoice.paid_amount)).toBeInTheDocument();
    expect(screen.getByDisplayValue(invoice.note ?? "")).toBeInTheDocument();
    expect(screen.getByText(invoice.customer_snapshot_name)).toBeInTheDocument();
    expect(screen.getByText(invoice.items[0].product_code_snapshot)).toBeInTheDocument();
    expect(screen.getByText(invoice.items[0].product_name_snapshot)).toBeInTheDocument();
  });

  it("edit submit calls PATCH instead of POST and redirects to invoice detail by default", async () => {
    const invoice = invoiceFixture();
    const fetchMock = mockSalesPosSession("owner", { invoice });
    const testUser = userEvent.setup();
    const { router, container } = renderSalesRoute({
      pathname: "/sales/invoices/new",
      state: { editInvoiceDraft: { invoiceId: invoice.id } },
    });

    await waitFor(() => {
      expect(activeTabLabel(container)).toContain(invoice.invoice_code);
    });
    await testUser.click(payButton(container));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/sales/invoices/${invoice.id}`);
    });
    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith(`/sales/invoices/${invoice.id}`) && call[1]?.method === "PATCH")).toBe(true);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/sales/invoices") && call[1]?.method === "POST")).toBe(false);
  });

  it("create mode still calls POST", async () => {
    const fetchMock = mockSalesPosSession("owner");
    const testUser = userEvent.setup();
    const { container } = renderSalesRoute({
      pathname: "/sales/invoices/new",
      state: {
        sourceOrderDraft: {
          sourceOrderId: 61,
          customerId: "21",
          customerSnapshotName: "Cong ty Minh Anh",
          note: "Don tu nguon",
          items: [{ productId: "10", unitType: "BAO", quantity: "1.000", unitPrice: "250000.00" }],
        },
      },
    });

    await screen.findByText("Don tu nguon");
    await testUser.click(payButton(container));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/sales/invoices") && call[1]?.method === "POST")).toBe(true);
    });
  });

  it("cancel edit from invoice detail returns to invoice detail without PATCH", async () => {
    const invoice = invoiceFixture();
    const fetchMock = mockSalesPosSession("owner", { invoice });
    const testUser = userEvent.setup();
    const { router, container } = renderSalesRoute({
      pathname: "/sales/invoices/new",
      state: { editInvoiceDraft: { invoiceId: invoice.id, returnTo: `/sales/invoices/${invoice.id}`, returnLabel: "Quay l\u1ea1i h\u00f3a \u0111\u01a1n" } },
    });

    await waitFor(() => {
      expect(activeTabLabel(container)).toContain(invoice.invoice_code);
    });
    await testUser.click(cancelEditButton(container));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/sales/invoices/${invoice.id}`);
    });
    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith(`/sales/invoices/${invoice.id}`) && call[1]?.method === "PATCH")).toBe(false);
  });

  it("reuses an existing edit draft for the same invoice instead of duplicating tabs", async () => {
    const invoice = invoiceFixture();
    mockSalesPosSession("owner", { invoice });
    const { router, container } = renderSalesRoute({
      pathname: "/sales/invoices/new",
      state: { editInvoiceDraft: { invoiceId: invoice.id } },
    });

    await waitFor(() => {
      expect(activeTabLabel(container)).toContain(invoice.invoice_code);
    });
    await router.navigate("/sales/invoices/new", { state: { editInvoiceDraft: { invoiceId: invoice.id } } });

    await waitFor(() => {
      expect(Array.from(container.querySelectorAll(".sales-draft-tab button")).filter((button) => button.textContent?.includes(invoice.invoice_code)).length).toBe(1);
    });
  });

  it("keeps inactive historical customer and product visible in edit draft", async () => {
    const invoice = {
      ...invoiceFixture(),
      customer_id: 999,
      customer_snapshot_name: "Khach cu",
      items: [
        {
          ...invoiceFixture().items[0],
          product_id: 999,
          product_code_snapshot: "OLD-01",
          product_name_snapshot: "Hang cu",
        },
      ],
    };
    mockSalesPosSession("owner", { invoice });
    const { container } = renderSalesRoute({
      pathname: "/sales/invoices/new",
      state: { editInvoiceDraft: { invoiceId: invoice.id } },
    });

    await waitFor(() => {
      expect(activeTabLabel(container)).toContain(invoice.invoice_code);
    });
    expect(screen.getByText("Khach cu")).toBeInTheDocument();
    expect(screen.getByText("OLD-01")).toBeInTheDocument();
    expect(screen.getByText("Hang cu")).toBeInTheDocument();
  });

  it("pressing Enter does not submit an edit draft", async () => {
    const invoice = invoiceFixture();
    const fetchMock = mockSalesPosSession("owner", { invoice });
    const testUser = userEvent.setup();
    const { router, container } = renderSalesRoute({
      pathname: "/sales/invoices/new",
      state: { editInvoiceDraft: { invoiceId: invoice.id } },
    });

    await waitFor(() => {
      expect(activeTabLabel(container)).toContain(invoice.invoice_code);
    });
    await testUser.click(paidAmountInput(container));
    await testUser.keyboard("{Enter}");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/sales/invoices/new");
    });
    expect(
      fetchMock.mock.calls.some((call) => {
        const url = String(call[0]);
        const method = call[1]?.method;
        return url.includes("/sales/invoices") && (method === "PATCH" || method === "POST");
      }),
    ).toBe(false);
  });

  it("edit fetch error shows explicit error instead of infinite loading", async () => {
    const invoice = invoiceFixture();
    mockSalesPosSession("owner", { invoice, failInvoiceFetch: true });
    renderSalesRoute({
      pathname: "/sales/invoices/new",
      state: { editInvoiceDraft: { invoiceId: invoice.id, returnTo: `/sales/invoices/${invoice.id}`, returnLabel: "Quay l\u1ea1i h\u00f3a \u0111\u01a1n" } },
    });

    expect(await screen.findByText("Invoice not found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Th\u1eed l\u1ea1i" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quay l\u1ea1i h\u00f3a \u0111\u01a1n" })).toBeInTheDocument();
  });

  it("edit submit from invoice detail returns to invoice detail and does not POST", async () => {
    const invoice = invoiceFixture();
    const fetchMock = mockSalesPosSession("owner", { invoice });
    const testUser = userEvent.setup();
    const { router, container } = renderSalesRoute({
      pathname: "/sales/invoices/new",
      state: { editInvoiceDraft: { invoiceId: invoice.id, returnTo: `/sales/invoices/${invoice.id}`, returnLabel: "Quay l\u1ea1i h\u00f3a \u0111\u01a1n" } },
    });

    await waitFor(() => {
      expect(activeTabLabel(container)).toContain(invoice.invoice_code);
    });
    await testUser.click(payButton(container));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/sales/invoices/${invoice.id}`);
    });
    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith(`/sales/invoices/${invoice.id}`) && call[1]?.method === "PATCH")).toBe(true);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/sales/invoices") && call[1]?.method === "POST")).toBe(false);
  });
});
